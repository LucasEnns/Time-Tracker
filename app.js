const STORAGE_KEY = 'time-tracker-v1'
const APP_VERSION = 1

const DEFAULT_SETTINGS = {
  targetHoursPerWeek: 40,
  breakMinutesPer8h: 30,
  weekStartsOn: 1,
}

let state = loadState()
let selectedMode = state.activeSession?.mode || 'work'
let tickInterval = null

const el = {
  liveTimer: document.getElementById('liveTimer'),
  sessionMeta: document.getElementById('sessionMeta'),
  startStopBtn: document.getElementById('startStopBtn'),
  modeWorkBtn: document.getElementById('modeWorkBtn'),
  modeBreakBtn: document.getElementById('modeBreakBtn'),
  projectInput: document.getElementById('projectInput'),
  projectList: document.getElementById('projectList'),
  totalWorked: document.getElementById('totalWorked'),
  yearAvg: document.getElementById('yearAvg'),
  weekSoFar: document.getElementById('weekSoFar'),
  daySoFar: document.getElementById('daySoFar'),
  targetHoursInput: document.getElementById('targetHoursInput'),
  breakCapInput: document.getElementById('breakCapInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsHint: document.getElementById('settingsHint'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  dataHint: document.getElementById('dataHint'),
}

init()

function init() {
  bindEvents()
  hydrateInputs()
  ensureTicker()
  render()
}

function bindEvents() {
  el.startStopBtn.addEventListener('click', onStartStop)
  el.modeWorkBtn.addEventListener('click', () => onChangeMode('work'))
  el.modeBreakBtn.addEventListener('click', () => onChangeMode('break'))
  el.saveSettingsBtn.addEventListener('click', onSaveSettings)
  el.exportBtn.addEventListener('click', onExportJson)
  el.importInput.addEventListener('change', onImportJson)
}

function hydrateInputs() {
  el.targetHoursInput.value = String(state.settings.targetHoursPerWeek)
  el.breakCapInput.value = String(state.settings.breakMinutesPer8h)
  el.projectInput.value = state.activeSession?.project || 'General'
}

function onStartStop() {
  if (state.activeSession) {
    closeActiveSession()
    setHint(el.dataHint, 'Session stopped.')
  } else {
    startSession(selectedMode, getProjectInput())
    setHint(el.dataHint, 'Session started.')
  }
  render()
}

function onChangeMode(mode) {
  if (mode !== 'work' && mode !== 'break') {
    return
  }

  selectedMode = mode

  if (state.activeSession && state.activeSession.mode !== mode) {
    closeActiveSession()
    startSession(mode, getProjectInput())
    setHint(el.dataHint, `Switched to ${mode} mode and split session.`)
  }

  render()
}

function onSaveSettings() {
  const target = Number(el.targetHoursInput.value)
  const breakCap = Number(el.breakCapInput.value)

  if (!Number.isFinite(target) || target <= 0) {
    setHint(el.settingsHint, 'Target hours/week must be greater than 0.')
    return
  }

  if (!Number.isFinite(breakCap) || breakCap < 0) {
    setHint(el.settingsHint, 'Break cap must be 0 or greater.')
    return
  }

  state.settings.targetHoursPerWeek = target
  state.settings.breakMinutesPer8h = breakCap
  saveState()
  setHint(el.settingsHint, 'Settings saved.')
  render()
}

function onExportJson() {
  const payload = JSON.stringify(state, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `time-tracker-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  setHint(el.dataHint, 'Exported JSON backup.')
}

async function onImportJson(event) {
  const file = event.target.files?.[0]
  if (!file) {
    return
  }

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const imported = normalizeImportedState(parsed)
    const mergedCount = mergeSessions(imported.sessions)

    state.settings = {
      ...state.settings,
      ...imported.settings,
      weekStartsOn: 1,
    }

    // Active session is intentionally not imported to avoid phantom running timers.
    saveState()
    hydrateInputs()
    render()
    setHint(el.dataHint, `Imported ${mergedCount} new sessions.`)
  } catch (error) {
    setHint(el.dataHint, 'Import failed: invalid file format.')
  } finally {
    event.target.value = ''
  }
}

function startSession(mode, project) {
  const now = Date.now()
  state.activeSession = {
    id: createId(),
    start: now,
    mode,
    project,
  }
  saveState()
  ensureTicker()
}

function closeActiveSession() {
  if (!state.activeSession) {
    return
  }

  const now = Date.now()
  const session = {
    id: state.activeSession.id,
    start: state.activeSession.start,
    end: now,
    mode: state.activeSession.mode,
    project: state.activeSession.project,
    durationMs: Math.max(0, now - state.activeSession.start),
  }

  state.sessions.push(session)
  state.activeSession = null
  saveState()
  ensureTicker()
}

function ensureTicker() {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }

  if (state.activeSession) {
    tickInterval = setInterval(() => {
      renderLiveTimer()
      renderStats()
    }, 1000)
  }
}

function render() {
  renderModeButtons()
  renderProjects()
  renderLiveTimer()
  renderStats()

  const isRunning = Boolean(state.activeSession)
  el.startStopBtn.textContent = isRunning ? 'Stop' : 'Start'
  el.sessionMeta.textContent = isRunning
    ? `${state.activeSession.mode.toUpperCase()} • ${state.activeSession.project || 'General'}`
    : 'Stopped'
}

function renderModeButtons() {
  el.modeWorkBtn.classList.toggle('active', selectedMode === 'work')
  el.modeBreakBtn.classList.toggle('active', selectedMode === 'break')
}

function renderProjects() {
  const projects = [...collectProjects(state.sessions, state.activeSession)].sort((a, b) =>
    a.localeCompare(b),
  )

  el.projectList.innerHTML = ''
  for (const project of projects) {
    const option = document.createElement('option')
    option.value = project
    el.projectList.appendChild(option)
  }
}

function renderLiveTimer() {
  if (!state.activeSession) {
    el.liveTimer.textContent = '00:00:00'
    return
  }

  const elapsedMs = Date.now() - state.activeSession.start
  el.liveTimer.textContent = formatClock(elapsedMs)
}

function renderStats() {
  const now = new Date()
  const sessions = materializeSessionsForNow()

  const total = computeEffectiveWorkedMs(sessions, state.settings)
  const day = computeEffectiveWorkedMs(
    filterByRange(sessions, startOfDay(now), now),
    state.settings,
  )
  const week = computeEffectiveWorkedMs(
    filterByRange(sessions, startOfWeek(now, state.settings.weekStartsOn), now),
    state.settings,
  )

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearSessions = filterByRange(sessions, yearStart, now)
  const activeWeeks = countActiveWeeks(yearSessions, state.settings.weekStartsOn)
  const yearTotal = computeEffectiveWorkedMs(yearSessions, state.settings)
  const avgYearWeek = activeWeeks > 0 ? yearTotal / activeWeeks : 0

  el.totalWorked.textContent = formatDuration(total)
  el.daySoFar.textContent = formatDuration(day)
  el.weekSoFar.textContent = formatDuration(week)
  el.yearAvg.textContent = formatDuration(avgYearWeek)
}

function getProjectInput() {
  const value = el.projectInput.value.trim()
  return value || 'General'
}

function setHint(node, text) {
  node.textContent = text
}

function materializeSessionsForNow() {
  const sessions = [...state.sessions]
  if (state.activeSession) {
    const now = Date.now()
    sessions.push({
      id: state.activeSession.id,
      start: state.activeSession.start,
      end: now,
      mode: state.activeSession.mode,
      project: state.activeSession.project,
      durationMs: Math.max(0, now - state.activeSession.start),
    })
  }
  return sessions
}

function filterByRange(sessions, startDate, endDate) {
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()

  return sessions
    .map((session) => {
      const overlapStart = Math.max(session.start, startMs)
      const overlapEnd = Math.min(session.end, endMs)
      const durationMs = overlapEnd - overlapStart

      if (durationMs <= 0) {
        return null
      }

      return {
        ...session,
        start: overlapStart,
        end: overlapEnd,
        durationMs,
      }
    })
    .filter(Boolean)
}

function computeEffectiveWorkedMs(sessions, settings) {
  let workMs = 0
  let breakMs = 0

  for (const session of sessions) {
    if (session.mode === 'work') {
      workMs += session.durationMs
    } else if (session.mode === 'break') {
      breakMs += session.durationMs
    }
  }

  const allowedBreakMs = (workMs / (8 * 60 * 60 * 1000)) * settings.breakMinutesPer8h * 60 * 1000
  const excessBreakMs = Math.max(0, breakMs - allowedBreakMs)
  return Math.max(0, workMs - excessBreakMs)
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date, weekStartsOn) {
  const day = date.getDay()
  const diff = (day - weekStartsOn + 7) % 7
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - diff)
  return start
}

function countActiveWeeks(sessions, weekStartsOn) {
  const keys = new Set()
  for (const session of sessions) {
    const start = startOfWeek(new Date(session.start), weekStartsOn)
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`
    keys.add(key)
  }
  return keys.size
}

function formatClock(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function collectProjects(sessions, activeSession) {
  const projects = new Set(['General'])
  for (const session of sessions) {
    if (session.project) {
      projects.add(session.project)
    }
  }
  if (activeSession?.project) {
    projects.add(activeSession.project)
  }
  return projects
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultState()
    }

    const parsed = JSON.parse(raw)
    return normalizeImportedState(parsed)
  } catch {
    return defaultState()
  }
}

function saveState() {
  const payload = {
    version: APP_VERSION,
    settings: state.settings,
    sessions: state.sessions,
    activeSession: state.activeSession,
    updatedAt: Date.now(),
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function defaultState() {
  return {
    version: APP_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    activeSession: null,
    updatedAt: Date.now(),
  }
}

function normalizeImportedState(input) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(input && typeof input === 'object' ? input.settings : null),
    weekStartsOn: 1,
  }

  const sessions = Array.isArray(input?.sessions)
    ? input.sessions
        .map((session) => normalizeSession(session))
        .filter((session) => session && session.end > session.start)
    : []

  const activeSession = normalizeActiveSession(input?.activeSession)

  return {
    version: APP_VERSION,
    settings,
    sessions,
    activeSession,
    updatedAt: Date.now(),
  }
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null
  }

  const start = Number(session.start)
  const end = Number(session.end)
  const mode = session.mode === 'break' ? 'break' : 'work'
  const project =
    typeof session.project === 'string' && session.project.trim()
      ? session.project.trim()
      : 'General'

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }

  return {
    id: typeof session.id === 'string' ? session.id : createId(),
    start,
    end,
    mode,
    project,
    durationMs: Math.max(0, end - start),
  }
}

function normalizeActiveSession(session) {
  if (!session || typeof session !== 'object') {
    return null
  }

  const start = Number(session.start)
  if (!Number.isFinite(start) || start > Date.now()) {
    return null
  }

  return {
    id: typeof session.id === 'string' ? session.id : createId(),
    start,
    mode: session.mode === 'break' ? 'break' : 'work',
    project:
      typeof session.project === 'string' && session.project.trim()
        ? session.project.trim()
        : 'General',
  }
}

function mergeSessions(importedSessions) {
  const seenIds = new Set(state.sessions.map((s) => s.id))
  let added = 0

  for (const session of importedSessions) {
    if (!seenIds.has(session.id)) {
      state.sessions.push(session)
      seenIds.add(session.id)
      added += 1
    }
  }

  state.sessions.sort((a, b) => a.start - b.start)
  return added
}
