const STORAGE_KEY = 'time-tracker-v2'
const APP_VERSION = 2

const DEFAULT_SETTINGS = {
  targetHoursPerWeek: 40,
  trackingStartDate: '',
  paidBreakIntervalHours: 3.75,
  paidBreakMinutes: 15,
  weekStartsOn: 1,
}

let state = loadState()
let tickInterval = null
let projectInputPrevious = state.activeSession?.project || state.lastProject || 'General'

const el = {
  liveTimer: document.getElementById('liveTimer'),
  startStopBtn: document.getElementById('startStopBtn'),

  projectOpenBtn: document.getElementById('projectOpenBtn'),
  projectCloseBtn: document.getElementById('projectCloseBtn'),
  projectOverlay: document.getElementById('projectOverlay'),

  settingsOpenBtn: document.getElementById('settingsOpenBtn'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  settingsOverlay: document.getElementById('settingsOverlay'),

  projectInput: document.getElementById('projectInput'),
  projectDropdown: document.getElementById('projectDropdown'),
  projectBreakdownList: document.getElementById('projectBreakdownList'),
  projectDataHint: document.getElementById('projectDataHint'),

  yearAvg: document.getElementById('yearAvg'),
  weekSoFar: document.getElementById('weekSoFar'),
  daySoFar: document.getElementById('daySoFar'),
  dayBreakBonus: document.getElementById('dayBreakBonus'),
  weekDelta: document.getElementById('weekDelta'),
  yearDelta: document.getElementById('yearDelta'),

  targetHoursInput: document.getElementById('targetHoursInput'),
  startDateInput: document.getElementById('startDateInput'),
  breakIntervalHoursInput: document.getElementById('breakIntervalHoursInput'),
  paidBreakMinutesInput: document.getElementById('paidBreakMinutesInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsHint: document.getElementById('settingsHint'),

  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  jsonHint: document.getElementById('jsonHint'),

  exportProjectCsvBtn: document.getElementById('exportProjectCsvBtn'),
}

init()

function init() {
  bindEvents()
  hydrateInputs()
  ensureTicker()
  render()
}

function bindEvents() {
  el.startStopBtn.addEventListener('click', onClockToggle)

  el.projectOpenBtn.addEventListener('click', () => setOverlayOpen(el.projectOverlay, true))
  el.projectCloseBtn.addEventListener('click', () => setOverlayOpen(el.projectOverlay, false))
  el.projectOverlay.addEventListener('click', (event) => {
    if (event.target === el.projectOverlay) {
      setOverlayOpen(el.projectOverlay, false)
    }
  })

  el.settingsOpenBtn.addEventListener('click', () => setOverlayOpen(el.settingsOverlay, true))
  el.settingsCloseBtn.addEventListener('click', () => setOverlayOpen(el.settingsOverlay, false))
  el.settingsOverlay.addEventListener('click', (event) => {
    if (event.target === el.settingsOverlay) {
      setOverlayOpen(el.settingsOverlay, false)
    }
  })

  el.projectInput.addEventListener('change', onProjectChanged)
  el.projectInput.addEventListener('blur', onProjectInputBlur)
  el.projectInput.addEventListener('focus', () => {
    projectInputPrevious = getProjectInput()
    showProjectDropdown()
  })
  el.projectInput.addEventListener('input', showProjectDropdown)
  el.projectInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      onProjectChanged()
    }
  })

  document.addEventListener('click', onDocumentClick)

  el.saveSettingsBtn.addEventListener('click', onSaveSettings)
  el.exportBtn.addEventListener('click', onExportJson)
  el.exportProjectCsvBtn.addEventListener('click', onExportProjectCsv)
  el.importInput.addEventListener('change', onImportJson)
}

function hydrateInputs() {
  el.targetHoursInput.value = String(state.settings.targetHoursPerWeek)
  el.startDateInput.value = state.settings.trackingStartDate || ''
  el.breakIntervalHoursInput.value = String(state.settings.paidBreakIntervalHours)
  el.paidBreakMinutesInput.value = String(state.settings.paidBreakMinutes)
  el.projectInput.value = state.activeSession?.project || state.lastProject || 'General'
  projectInputPrevious = getProjectInput()
}

function onClockToggle() {
  if (state.activeSession) {
    processPaidBreakAwards()
    closeActiveSession({ keepRun: false })
  } else {
    startSession(getProjectInput())
  }
  render()
}

function onProjectChanged() {
  const nextProject = getProjectInput()
  const knownProjects = new Set(
    collectProjects(state.sessions, state.activeSession, state.paidBreakAwards),
  )

  if (!state.activeSession) {
    const previousProject = projectInputPrevious
    if (
      previousProject &&
      previousProject !== nextProject &&
      knownProjects.has(previousProject) &&
      !knownProjects.has(nextProject)
    ) {
      const renamedCount = renameProjectEverywhere(previousProject, nextProject)
      saveState()
      setHint(
        el.projectDataHint,
        `Renamed ${previousProject} to ${nextProject} (${renamedCount} records).`,
      )
      render()
    }
    projectInputPrevious = nextProject
    state.lastProject = nextProject
    saveState()
    return
  }

  const currentProject = state.activeSession.project
  if (nextProject === currentProject) {
    projectInputPrevious = nextProject
    return
  }

  processPaidBreakAwards()
  closeActiveSession({ keepRun: true })
  startSession(nextProject, { keepRun: true })
  setHint(el.projectDataHint, `Switched project to ${nextProject}.`)
  projectInputPrevious = nextProject
  render()
}

function onProjectInputBlur() {
  setTimeout(() => {
    onProjectChanged()
    hideProjectDropdown()
  }, 120)
}

function onDocumentClick(event) {
  const target = event.target
  if (target === el.projectInput || el.projectDropdown.contains(target)) {
    return
  }
  hideProjectDropdown()
}

function onSaveSettings() {
  const target = Number(el.targetHoursInput.value)
  const trackingStartDate = el.startDateInput.value
  const intervalHours = Number(el.breakIntervalHoursInput.value)
  const paidBreak = Number(el.paidBreakMinutesInput.value)

  if (!Number.isFinite(target) || target <= 0) {
    setHint(el.settingsHint, 'Target hours/week must be greater than 0.')
    return
  }

  if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
    setHint(el.settingsHint, 'Break interval must be greater than 0 hours.')
    return
  }

  if (trackingStartDate) {
    const parsedStart = parseDateOnly(trackingStartDate)
    if (!parsedStart) {
      setHint(el.settingsHint, 'Tracking start date is invalid.')
      return
    }
  }

  if (!Number.isFinite(paidBreak) || paidBreak < 0) {
    setHint(el.settingsHint, 'Paid break minutes must be 0 or greater.')
    return
  }

  state.settings.targetHoursPerWeek = target
  state.settings.trackingStartDate = trackingStartDate || ''
  state.settings.paidBreakIntervalHours = intervalHours
  state.settings.paidBreakMinutes = paidBreak
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
  setHint(el.jsonHint, 'Exported JSON backup.')
}

function onExportProjectCsv() {
  const now = new Date()
  const rows = getProjectBreakdownRows(now)

  const header = ['Project', 'Day', 'Week', 'Total']
  const csvRows = [header, ...rows.map((row) => [row.project, row.day, row.week, row.total])]
  const csv = csvRows.map((row) => row.map(csvEscape).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `time-tracker-project-breakdown-${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
  setHint(el.projectDataHint, 'Exported project breakdown CSV.')
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

    state.settings = {
      ...state.settings,
      ...imported.settings,
      weekStartsOn: 1,
    }

    const mergedSessions = mergeById(state.sessions, imported.sessions)
    const mergedAwards = mergeById(state.paidBreakAwards, imported.paidBreakAwards)
    saveState()
    hydrateInputs()
    render()
    setHint(el.jsonHint, `Imported ${mergedSessions + mergedAwards} new records.`)
  } catch {
    setHint(el.jsonHint, 'Import failed: invalid file format.')
  } finally {
    event.target.value = ''
  }
}

function setOverlayOpen(node, isOpen) {
  node.classList.toggle('open', isOpen)
  node.setAttribute('aria-hidden', String(!isOpen))
}

function startSession(project, options = {}) {
  const now = Date.now()
  const keepRun = Boolean(options.keepRun)

  if (!keepRun || !state.activeRunStart) {
    state.activeRunStart = now
    state.activeBreaksGranted = 0
  }

  state.activeSession = {
    id: createId(),
    start: now,
    project,
  }

  state.lastProject = project

  saveState()
  ensureTicker()
}

function closeActiveSession(options = {}) {
  if (!state.activeSession) {
    return
  }

  const now = Date.now()
  const keepRun = Boolean(options.keepRun)

  state.sessions.push({
    id: state.activeSession.id,
    start: state.activeSession.start,
    end: now,
    project: state.activeSession.project,
    durationMs: Math.max(0, now - state.activeSession.start),
  })

  state.activeSession = null
  if (!keepRun) {
    state.activeRunStart = null
    state.activeBreaksGranted = 0
  }

  saveState()
  ensureTicker()
}

function processPaidBreakAwards() {
  if (!state.activeSession || !state.activeRunStart) {
    return
  }

  const intervalMs = state.settings.paidBreakIntervalHours * 60 * 60 * 1000
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return
  }

  const elapsed = Date.now() - state.activeRunStart
  const shouldHaveGranted = Math.floor(elapsed / intervalMs)

  while (state.activeBreaksGranted < shouldHaveGranted) {
    state.activeBreaksGranted += 1
    const awardTime = state.activeRunStart + state.activeBreaksGranted * intervalMs

    state.paidBreakAwards.push({
      id: createId(),
      at: awardTime,
      project: state.activeSession.project,
      durationMs: state.settings.paidBreakMinutes * 60 * 1000,
    })
  }

  saveState()
}

function ensureTicker() {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }

  if (state.activeSession) {
    tickInterval = setInterval(() => {
      processPaidBreakAwards()
      renderLiveTimer()
      renderStats()
      renderProjectBreakdown(new Date())
    }, 1000)
  }
}

function render() {
  renderProjects()
  renderLiveTimer()
  renderStats()
  renderProjectBreakdown(new Date())

  const running = Boolean(state.activeSession)
  el.startStopBtn.textContent = running ? 'Clock Out' : 'Clock In'
}

function renderProjects() {
  const projects = getProjectsByLastUse(state.sessions, state.activeSession, state.paidBreakAwards)
  el.projectDropdown.innerHTML = ''

  for (const project of projects) {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = 'project-option'
    option.textContent = project
    option.setAttribute('role', 'option')
    option.addEventListener('mousedown', (event) => {
      event.preventDefault()
      selectProjectFromDropdown(project)
    })
    el.projectDropdown.appendChild(option)
  }
}

function selectProjectFromDropdown(project) {
  el.projectInput.value = project
  onProjectChanged()
  hideProjectDropdown()
}

function showProjectDropdown() {
  if (!el.projectDropdown.children.length) {
    return
  }
  el.projectDropdown.classList.add('open')
}

function hideProjectDropdown() {
  el.projectDropdown.classList.remove('open')
}

function renderLiveTimer() {
  if (!state.activeSession || !state.activeRunStart) {
    el.liveTimer.textContent = '00:00:00'
    return
  }

  const elapsed = Date.now() - state.activeRunStart
  el.liveTimer.textContent = formatClock(elapsed)
}

function renderStats() {
  const now = new Date()
  const day = computeRangeTotalMs(startOfDay(now), now)
  const week = computeRangeTotalMs(startOfWeek(now, state.settings.weekStartsOn), now)

  const trackingStart = resolveTrackingStart(now)
  const totalSinceStart = computeRangeTotalMs(trackingStart, now)
  const activeWeeks = countActiveWeeks(trackingStart, now, state.settings.weekStartsOn)
  const avgYearWeek = activeWeeks > 0 ? totalSinceStart / activeWeeks : 0
  const weekTargetMs = state.settings.targetHoursPerWeek * 60 * 60 * 1000
  const weekDeltaMs = week - weekTargetMs

  const elapsedWeeksSinceStart = Math.max(0, computeElapsedWeeks(trackingStart, now))
  const targetSinceStartMs = elapsedWeeksSinceStart * weekTargetMs
  const yearDeltaMs = totalSinceStart - targetSinceStartMs

  const dayBonus = computeAwardRangeMs(startOfDay(now), now)

  el.daySoFar.textContent = formatDuration(day)
  el.weekSoFar.textContent = formatDuration(week)
  el.yearAvg.textContent = formatDuration(avgYearWeek)
  el.dayBreakBonus.textContent = formatDuration(dayBonus)
  el.weekDelta.textContent = formatSignedDuration(weekDeltaMs)
  el.yearDelta.textContent = formatSignedDuration(yearDeltaMs)
}

function renderProjectBreakdown(now) {
  const rows = getProjectBreakdownRows(now)
  el.projectBreakdownList.innerHTML = ''

  for (const row of rows) {
    const item = document.createElement('article')
    item.className = 'project-breakdown-row'
    item.innerHTML = `
      <div class="project-breakdown-name">${escapeHtml(row.project)}</div>
      <div class="project-breakdown-meta">Day ${row.day} • Week ${row.week} • Total ${
      row.total
    }</div>
    `
    el.projectBreakdownList.appendChild(item)
  }
}

function getProjectBreakdownRows(now) {
  const projects = getProjectsByLastUse(state.sessions, state.activeSession, state.paidBreakAwards)
  const dayStart = startOfDay(now)
  const weekStart = startOfWeek(now, state.settings.weekStartsOn)

  return projects.map((project) => {
    return {
      project,
      day: formatDuration(computeProjectRangeTotalMs(project, dayStart, now)),
      week: formatDuration(computeProjectRangeTotalMs(project, weekStart, now)),
      total: formatDuration(computeProjectRangeTotalMs(project, null, now)),
    }
  })
}

function computeRangeTotalMs(startDate, endDate) {
  return computeSessionRangeMs(startDate, endDate) + computeAwardRangeMs(startDate, endDate)
}

function computeProjectRangeTotalMs(project, startDate, endDate) {
  return (
    computeSessionRangeMs(startDate, endDate, project) +
    computeAwardRangeMs(startDate, endDate, project)
  )
}

function computeSessionRangeMs(startDate, endDate, project) {
  const sessions = materializeSessionsForNow()
  const startMs = startDate ? startDate.getTime() : Number.MIN_SAFE_INTEGER
  const endMs = endDate.getTime()

  let total = 0
  for (const session of sessions) {
    if (project && session.project !== project) {
      continue
    }
    const overlapStart = Math.max(session.start, startMs)
    const overlapEnd = Math.min(session.end, endMs)
    if (overlapEnd > overlapStart) {
      total += overlapEnd - overlapStart
    }
  }
  return total
}

function computeAwardRangeMs(startDate, endDate, project) {
  const awards = materializeAwardsForNow()
  const startMs = startDate ? startDate.getTime() : Number.MIN_SAFE_INTEGER
  const endMs = endDate.getTime()

  let total = 0
  for (const award of awards) {
    if (project && award.project !== project) {
      continue
    }
    if (award.at >= startMs && award.at <= endMs) {
      total += award.durationMs
    }
  }
  return total
}

function materializeSessionsForNow() {
  const sessions = [...state.sessions]
  if (state.activeSession) {
    const now = Date.now()
    sessions.push({
      id: state.activeSession.id,
      start: state.activeSession.start,
      end: now,
      project: state.activeSession.project,
      durationMs: Math.max(0, now - state.activeSession.start),
    })
  }
  return sessions
}

function materializeAwardsForNow() {
  return [...state.paidBreakAwards]
}

function countActiveWeeks(startDate, endDate, weekStartsOn) {
  const keys = new Set()

  const sessions = materializeSessionsForNow()
  for (const session of sessions) {
    if (session.end < startDate.getTime() || session.start > endDate.getTime()) {
      continue
    }
    const weekStart = startOfWeek(new Date(session.start), weekStartsOn)
    keys.add(dayKey(weekStart))
  }

  const awards = materializeAwardsForNow()
  for (const award of awards) {
    if (award.at < startDate.getTime() || award.at > endDate.getTime()) {
      continue
    }
    const weekStart = startOfWeek(new Date(award.at), weekStartsOn)
    keys.add(dayKey(weekStart))
  }

  return keys.size
}

function getProjectInput() {
  const value = el.projectInput.value.trim()
  return value || 'General'
}

function setHint(node, text) {
  node.textContent = text
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

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function countElapsedCalendarWeeksInYear(date, weekStartsOn) {
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const currentWeekStart = startOfWeek(date, weekStartsOn)
  const firstWeekStart = startOfWeek(yearStart, weekStartsOn)
  const diffMs = currentWeekStart.getTime() - firstWeekStart.getTime()
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

function resolveTrackingStart(now) {
  const parsed = parseDateOnly(state.settings.trackingStartDate)
  if (!parsed) {
    return new Date(now.getFullYear(), 0, 1)
  }
  const todayStart = startOfDay(now)
  if (parsed.getTime() > todayStart.getTime()) {
    return todayStart
  }
  return parsed
}

function computeElapsedWeeks(startDate, endDate) {
  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime())
  return diffMs / (7 * 24 * 60 * 60 * 1000)
}

function parseDateOnly(value) {
  if (!value) {
    return null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }
  parsed.setHours(0, 0, 0, 0)
  return parsed
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

function formatSignedDuration(ms) {
  const sign = ms >= 0 ? '+' : '-'
  return `${sign}${formatDuration(Math.abs(ms))}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function csvEscape(value) {
  const text = String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function collectProjects(sessions, activeSession, awards = []) {
  const projects = new Set(['General'])
  for (const session of sessions) {
    if (session.project) {
      projects.add(session.project)
    }
  }
  for (const award of awards) {
    if (award.project) {
      projects.add(award.project)
    }
  }
  if (activeSession?.project) {
    projects.add(activeSession.project)
  }
  return projects
}

function getProjectsByLastUse(sessions, activeSession, awards = []) {
  const latestByProject = new Map([['General', 0]])

  for (const session of sessions) {
    if (!session.project) {
      continue
    }
    const current = latestByProject.get(session.project) || 0
    latestByProject.set(session.project, Math.max(current, session.end || session.start))
  }

  for (const award of awards) {
    if (!award.project) {
      continue
    }
    const current = latestByProject.get(award.project) || 0
    latestByProject.set(award.project, Math.max(current, award.at))
  }

  if (activeSession?.project) {
    latestByProject.set(activeSession.project, Date.now())
  }

  return [...latestByProject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([project]) => project)
}

function renameProjectEverywhere(oldName, newName) {
  if (!oldName || !newName || oldName === newName) {
    return 0
  }

  let count = 0
  for (const session of state.sessions) {
    if (session.project === oldName) {
      session.project = newName
      count += 1
    }
  }

  for (const award of state.paidBreakAwards) {
    if (award.project === oldName) {
      award.project = newName
      count += 1
    }
  }

  if (state.activeSession?.project === oldName) {
    state.activeSession.project = newName
  }

  return count
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return normalizeImportedState(JSON.parse(raw))
    }

    const legacyRaw = localStorage.getItem('time-tracker-v1')
    if (legacyRaw) {
      return migrateLegacyState(JSON.parse(legacyRaw))
    }

    return defaultState()
  } catch {
    return defaultState()
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: APP_VERSION,
      settings: state.settings,
      sessions: state.sessions,
      paidBreakAwards: state.paidBreakAwards,
      activeSession: state.activeSession,
      lastProject: state.lastProject,
      activeRunStart: state.activeRunStart,
      activeBreaksGranted: state.activeBreaksGranted,
      updatedAt: Date.now(),
    }),
  )
}

function defaultState() {
  return {
    version: APP_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    paidBreakAwards: [],
    activeSession: null,
    lastProject: 'General',
    activeRunStart: null,
    activeBreaksGranted: 0,
    updatedAt: Date.now(),
  }
}

function normalizeImportedState(input) {
  const base = defaultState()

  if (!input || typeof input !== 'object') {
    return base
  }

  const legacyMinutes = Number(input?.settings?.paidBreakIntervalMinutes)
  const inferredHours = Number.isFinite(legacyMinutes) ? legacyMinutes / 60 : undefined

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(input.settings || {}),
    paidBreakIntervalHours: Number.isFinite(Number(input?.settings?.paidBreakIntervalHours))
      ? Number(input.settings.paidBreakIntervalHours)
      : inferredHours || DEFAULT_SETTINGS.paidBreakIntervalHours,
    weekStartsOn: 1,
  }

  const sessions = Array.isArray(input.sessions)
    ? input.sessions
        .map(normalizeSession)
        .filter((session) => session && session.end > session.start)
    : []

  const paidBreakAwards = Array.isArray(input.paidBreakAwards)
    ? input.paidBreakAwards.map(normalizeAward).filter((award) => award && award.durationMs >= 0)
    : []

  const activeSession = normalizeActiveSession(input.activeSession)

  return {
    version: APP_VERSION,
    settings,
    sessions,
    paidBreakAwards,
    activeSession,
    lastProject:
      typeof input.lastProject === 'string' && input.lastProject.trim()
        ? input.lastProject.trim()
        : activeSession?.project || 'General',
    activeRunStart:
      Number.isFinite(Number(input.activeRunStart)) && Number(input.activeRunStart) > 0
        ? Number(input.activeRunStart)
        : activeSession?.start || null,
    activeBreaksGranted:
      Number.isFinite(Number(input.activeBreaksGranted)) && Number(input.activeBreaksGranted) >= 0
        ? Number(input.activeBreaksGranted)
        : 0,
    updatedAt: Date.now(),
  }
}

function migrateLegacyState(legacy) {
  const migrated = defaultState()

  migrated.settings.targetHoursPerWeek = Number(legacy?.settings?.targetHoursPerWeek) || 40
  migrated.settings.paidBreakIntervalHours = 3.75
  migrated.settings.paidBreakMinutes = 15

  if (Array.isArray(legacy?.sessions)) {
    for (const item of legacy.sessions) {
      const session = normalizeSession(item)
      if (!session) {
        continue
      }
      if (item.mode === 'break') {
        continue
      }
      migrated.sessions.push(session)
    }
  }

  migrated.activeSession = normalizeActiveSession(legacy?.activeSession)
  migrated.lastProject =
    migrated.activeSession?.project ||
    (Array.isArray(migrated.sessions) && migrated.sessions.length > 0
      ? migrated.sessions[migrated.sessions.length - 1].project
      : 'General')
  migrated.activeRunStart =
    Number.isFinite(Number(legacy?.activeRunStart)) && Number(legacy.activeRunStart) > 0
      ? Number(legacy.activeRunStart)
      : migrated.activeSession?.start || null

  return migrated
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null
  }

  const start = Number(session.start)
  const end = Number(session.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }

  const project =
    typeof session.project === 'string' && session.project.trim()
      ? session.project.trim()
      : 'General'

  return {
    id: typeof session.id === 'string' ? session.id : createId(),
    start,
    end,
    project,
    durationMs: Math.max(0, end - start),
  }
}

function normalizeAward(award) {
  if (!award || typeof award !== 'object') {
    return null
  }

  const at = Number(award.at)
  const durationMs = Number(award.durationMs)
  if (!Number.isFinite(at) || !Number.isFinite(durationMs)) {
    return null
  }

  const project =
    typeof award.project === 'string' && award.project.trim() ? award.project.trim() : 'General'

  return {
    id: typeof award.id === 'string' ? award.id : createId(),
    at,
    project,
    durationMs: Math.max(0, durationMs),
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

  const project =
    typeof session.project === 'string' && session.project.trim()
      ? session.project.trim()
      : 'General'

  return {
    id: typeof session.id === 'string' ? session.id : createId(),
    start,
    project,
  }
}

function mergeById(targetArray, sourceArray) {
  const seen = new Set(targetArray.map((item) => item.id))
  let added = 0
  for (const item of sourceArray) {
    if (!seen.has(item.id)) {
      targetArray.push(item)
      seen.add(item.id)
      added += 1
    }
  }
  return added
}
