const STORAGE_KEY = 'time-tracker-v2'
const APP_VERSION = 2

const DEFAULT_SETTINGS = {
  targetHoursPerWeek: 40,
  targetDaysPerWeek: 5,
  trackingStartDate: '',
  paidBreakIntervalHours: 3.75,
  paidBreakMinutes: 15,
  weekStartsOn: 1,
  syncMode: 'local',
  cloudPullMode: 'remote',
}

let state = loadState()
let tickInterval = null
let projectInputPrevious = state.activeSession?.project || state.lastProject || 'General'
let projectAddMode = false
let entryProjectAddMode = false
let openEntryEditorId = null
let pendingDeleteEntryId = null
let firebaseApp = null
let firebaseAuth = null
let firebaseDatabase = null
let firebaseUser = null
let firebaseConfigReady = false
let autoSyncPullAttempted = false
let autoSyncPushPending = false
let autoSyncPushTimer = null
let autoSyncPushInFlight = false
let isApplyingRemoteState = false

const PROJECT_ADD_NEW_TOKEN = '__add_new__'
const FIREBASE_CONFIG_GLOBAL = 'TIME_TRACKER_FIREBASE_CONFIG'
const UI_LANGUAGE = String(navigator.language || 'en')
  .toLowerCase()
  .startsWith('fr')
  ? 'fr'
  : 'en'

const I18N = {
  en: {
    appTitle: 'Time Tracker',
    projectsBtn: 'Timeline',
    settingsBtn: 'Settings',
    close: 'Close',
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    edit: 'Edit',
    clockIn: 'Clock In',
    clockOut: 'Clock Out',
    activeProject: 'Active Project',
    daySoFarLabel: 'Day So Far',
    paidBreakToday: 'Paid Break Added Today',
    weekSoFarLabel: 'Week So Far',
    weekOverUnder: 'Week Over / Under Target',
    avgActiveWeek: 'Avg / Active Week (Since Start)',
    sinceStartOverUnder: 'Since Start Over / Under',
    projectTotals: 'Project Totals',
    exportProjectCsv: 'Export Project CSV',
    recentEntries14: 'Recent Entries (Last 14 Days)',
    date: 'Date',
    project: 'Project',
    startTime: 'Start Time',
    endTime: 'End Time',
    endTimeOptional: 'End Time (optional)',
    addEntry: 'Add Entry',
    deleteEntryTitle: 'Delete Entry?',
    deleteForeverNote: 'This information will be lost forever.',
    tracking: 'Tracking',
    targetHoursWeek: 'Target Hours / Week',
    targetDaysWeek: 'Target Days / Week',
    firstDayOfWeek: 'First Day Of Week',
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    trackingStartDate: 'Tracking Start Date',
    paidBreakEveryHours: 'Paid Break Every (hours)',
    paidBreakLengthMin: 'Paid Break Length (minutes)',
    timeOff: 'Holidays / Vacation',
    daysOff: 'Days',
    addHoliday: 'Add Holiday',
    holidayHoursAdded: 'Adds {hours} for {days} day(s).',
    holidayDateRequired: 'Holiday date is required.',
    holidayDaysInvalid: 'Holiday days must be greater than 0.',
    holidayAdded: 'Holiday credit added for {date}.',
    holidayDeleted: 'Holiday credit deleted.',
    noHolidays: 'No holiday or vacation days added yet.',
    saveSettings: 'Save Settings',
    data: 'Data',
    syncMode: 'Sync Mode',
    syncModeLocal: 'Local Only',
    syncModeCloud: 'Cloud Sync',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    cloudPullMode: 'Pull Strategy',
    pullModeRemote: 'Remote Wins (Replace Local)',
    pullModeMerge: 'Merge By ID (Additive)',
    firebaseUnavailable: 'Firebase is not available yet. Please retry in a moment.',
    firebaseConfigMissing:
      'Firebase is not configured yet. Add firebase-config.js and enable Google sign-in plus Realtime Database.',
    firebaseConnected: 'Signed in with Google.',
    cloudNoBackup: 'No cloud backup exists for this account yet.',
    cloudPullDetailed:
      'Pulled {sessions} sessions and {awards} awards from cloud storage. Merged {merged}.',
    cloudPullActiveImported: 'Imported running session from cloud storage.',
    cloudPullRemoteDone:
      'Pulled from cloud storage as source of truth. Local state replaced ({sessions} sessions, {awards} awards).',
    localBackupCreated: 'Local backup created before replace.',
    cloudPushDone: 'Pushed current data to cloud storage.',
    firebaseSyncFailed: 'Cloud sync failed: {reason}',
    signInRequired: 'Sign in with Google to use cloud sync.',
    firebaseOriginUnsupported:
      'Google sign-in is not supported from file://. Open the app from https://lucasenns.github.io/Time-Tracker/ or a localhost server.',
    localModeActive: 'Local mode is active. No cloud connection is used.',
    cloudConnecting: 'Cloud mode is active. Connecting to Google and restoring sync.',
    cloudReconnectNeeded: 'Cloud mode is active, but Google needs to reconnect.',
    cloudStatusSignedOut: 'Not signed in. Local storage is still active.',
    cloudStatusSignedIn: 'Signed in as {email}. Cloud sync is active.',
    cloudInitialUploadDone: 'No cloud backup existed, so your local data was uploaded.',
    general: 'General',
    addNewProject: '+ Add New Project',
    typeNewProject: 'Type a new project name to add it.',
    alreadyExists: '{project} already exists.',
    addedProject: 'Added project {project}.',
    switchedProject: 'Switched project to {project}.',
    renamedProject: 'Renamed {from} to {to} ({count} records).',
    dateStartRequired: 'Date and start time are required.',
    dateTimeRequired: 'Date, start time, and end time are required.',
    startInvalid: 'Start time is invalid.',
    startFuture: 'Start time cannot be in the future.',
    endAfterStart: 'End time must be after start time.',
    endFuture: 'End time cannot be in the future.',
    outside14: 'Entry must be within the last 14 days.',
    runningAlready: 'A timer is already running. Edit the running entry below instead.',
    startedRunning: 'Started running entry for {project}.',
    addedEntry: 'Added {project} entry.',
    editDateStartRequired: 'Edit failed: date and start time are required.',
    editStartInvalid: 'Edit failed: start time is invalid.',
    editStartFuture: 'Edit failed: start time cannot be in the future.',
    editOutside14: 'Edit failed: entry must stay within last 14 days.',
    editEndAfterStart: 'Edit failed: end time must be after start time.',
    editEndFuture: 'Edit failed: end time cannot be in the future.',
    runningSaved: 'Running entry saved as a completed entry.',
    runningUpdated: 'Running entry updated.',
    entryUpdated: 'Entry updated.',
    entryDeleted: 'Entry deleted.',
    noEntries14: 'No work entries in the last 14 days.',
    runningTag: 'Running',
    runningWord: 'Running',
    settingsSaved: 'Settings saved.',
    targetHoursInvalid: 'Target hours/week must be greater than 0.',
    breakIntervalInvalid: 'Break interval must be greater than 0 hours.',
    targetDaysInvalid: 'Target days/week must be between 1 and 7.',
    trackingDateInvalid: 'Tracking start date is invalid.',
    weekStartInvalid: 'First day of week is invalid.',
    paidBreakInvalid: 'Paid break minutes must be 0 or greater.',
    exportJsonDone: 'Exported JSON backup.',
    exportCsvDone: 'Exported project breakdown CSV.',
    importFailed: 'Import failed: invalid file format.',
    pullModeInvalid: 'Pull strategy is invalid.',
    importDone: 'Imported {count} new records.',
  },
  fr: {
    appTitle: 'Suivi du temps',
    projectsBtn: 'Chronologie',
    settingsBtn: 'Parametres',
    close: 'Fermer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    save: 'Enregistrer',
    edit: 'Modifier',
    clockIn: 'Pointer entree',
    clockOut: 'Pointer sortie',
    activeProject: 'Projet actif',
    daySoFarLabel: 'Aujourd hui',
    paidBreakToday: 'Pause payee ajoutee aujourd hui',
    weekSoFarLabel: 'Semaine en cours',
    weekOverUnder: 'Ecart hebdo / cible',
    avgActiveWeek: 'Moyenne / semaine active (depuis debut)',
    sinceStartOverUnder: 'Ecart depuis debut',
    projectTotals: 'Totaux par projet',
    exportProjectCsv: 'Exporter CSV projets',
    recentEntries14: 'Entrees recentes (14 derniers jours)',
    date: 'Date',
    project: 'Projet',
    startTime: 'Heure de debut',
    endTime: 'Heure de fin',
    endTimeOptional: 'Heure de fin (optionnel)',
    addEntry: 'Ajouter entree',
    deleteEntryTitle: 'Supprimer l entree ?',
    deleteForeverNote: 'Ces informations seront perdues definitivement.',
    tracking: 'Suivi',
    targetHoursWeek: 'Heures cible / semaine',
    targetDaysWeek: 'Jours cibles / semaine',
    firstDayOfWeek: 'Premier jour de la semaine',
    sunday: 'Dimanche',
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    trackingStartDate: 'Date de debut du suivi',
    paidBreakEveryHours: 'Pause payee toutes les (heures)',
    paidBreakLengthMin: 'Duree pause payee (minutes)',
    timeOff: 'Jours feries / Vacances',
    daysOff: 'Jours',
    addHoliday: 'Ajouter un conge',
    holidayHoursAdded: 'Ajoute {hours} pour {days} jour(s).',
    holidayDateRequired: 'La date du conge est obligatoire.',
    holidayDaysInvalid: 'Le nombre de jours doit etre superieur a 0.',
    holidayAdded: 'Credit de conge ajoute pour le {date}.',
    holidayDeleted: 'Credit de conge supprime.',
    noHolidays: 'Aucun jour ferie ou de vacances ajoute pour le moment.',
    saveSettings: 'Enregistrer les parametres',
    data: 'Donnees',
    syncMode: 'Mode de synchronisation',
    syncModeLocal: 'Local uniquement',
    syncModeCloud: 'Synchronisation cloud',
    exportJson: 'Exporter JSON',
    importJson: 'Importer JSON',
    cloudPullMode: 'Strategie de recuperation',
    pullModeRemote: 'Le distant gagne (remplacer local)',
    pullModeMerge: 'Fusion par ID (additif)',
    firebaseUnavailable: 'Firebase est indisponible pour l instant. Reessayez dans un moment.',
    firebaseConfigMissing:
      'Firebase n est pas encore configure. Ajoutez firebase-config.js et activez Google Sign-In avec Realtime Database.',
    firebaseConnected: 'Connexion Google etablie.',
    cloudNoBackup: 'Aucune sauvegarde cloud n existe encore pour ce compte.',
    cloudPullDetailed:
      '{sessions} sessions et {awards} pauses recuperes depuis le cloud. {merged} fusionnes.',
    cloudPullActiveImported: 'Session en cours importee depuis le cloud.',
    cloudPullRemoteDone:
      'Recuperation cloud en source de verite. Etat local remplace ({sessions} sessions, {awards} pauses).',
    localBackupCreated: 'Sauvegarde locale creee avant remplacement.',
    cloudPushDone: 'Donnees actuelles envoyees vers le cloud.',
    firebaseSyncFailed: 'Echec de synchronisation cloud: {reason}',
    signInRequired: 'Connectez-vous avec Google pour utiliser la synchronisation cloud.',
    firebaseOriginUnsupported:
      'La connexion Google n est pas prise en charge depuis file://. Ouvrez l app depuis https://lucasenns.github.io/Time-Tracker/ ou un serveur localhost.',
    localModeActive: 'Le mode local est actif. Aucune connexion cloud n est utilisee.',
    cloudConnecting:
      'Le mode cloud est actif. Connexion a Google et restauration de la synchronisation.',
    cloudReconnectNeeded: 'Le mode cloud est actif, mais Google doit etre reconnecte.',
    cloudStatusSignedOut: 'Non connecte. Le stockage local reste actif.',
    cloudStatusSignedIn: 'Connecte en tant que {email}. La synchronisation cloud est active.',
    cloudInitialUploadDone: 'Aucune sauvegarde cloud n existait, donc vos donnees locales ont ete envoyees.',
    general: 'General',
    addNewProject: '+ Ajouter un projet',
    typeNewProject: 'Saisissez un nouveau nom de projet pour l ajouter.',
    alreadyExists: '{project} existe deja.',
    addedProject: 'Projet {project} ajoute.',
    switchedProject: 'Projet actif: {project}.',
    renamedProject: '{from} renomme en {to} ({count} enregistrements).',
    dateStartRequired: 'La date et l heure de debut sont obligatoires.',
    dateTimeRequired: 'La date, l heure de debut et l heure de fin sont obligatoires.',
    startInvalid: 'L heure de debut est invalide.',
    startFuture: 'L heure de debut ne peut pas etre dans le futur.',
    endAfterStart: 'L heure de fin doit etre apres l heure de debut.',
    endFuture: 'L heure de fin ne peut pas etre dans le futur.',
    outside14: 'L entree doit etre dans les 14 derniers jours.',
    runningAlready:
      'Un chronometre est deja en cours. Modifiez plutot l entree en cours ci-dessous.',
    startedRunning: 'Entree en cours demarree pour {project}.',
    addedEntry: 'Entree {project} ajoutee.',
    editDateStartRequired: 'Modification impossible: date et heure de debut requises.',
    editStartInvalid: 'Modification impossible: heure de debut invalide.',
    editStartFuture: 'Modification impossible: heure de debut dans le futur.',
    editOutside14: 'Modification impossible: entree hors fenetre des 14 jours.',
    editEndAfterStart: 'Modification impossible: heure de fin apres debut requise.',
    editEndFuture: 'Modification impossible: heure de fin dans le futur.',
    runningSaved: 'Entree en cours enregistree comme entree terminee.',
    runningUpdated: 'Entree en cours mise a jour.',
    entryUpdated: 'Entree mise a jour.',
    entryDeleted: 'Entree supprimee.',
    noEntries14: 'Aucune entree de travail sur les 14 derniers jours.',
    runningTag: 'En cours',
    runningWord: 'En cours',
    settingsSaved: 'Parametres enregistres.',
    targetHoursInvalid: 'Heures/semaine doit etre superieur a 0.',
    breakIntervalInvalid: 'L intervalle de pause doit etre superieur a 0 heure.',
    targetDaysInvalid: 'Jours/semaine doit etre entre 1 et 7.',
    trackingDateInvalid: 'Date de debut invalide.',
    weekStartInvalid: 'Le premier jour de semaine est invalide.',
    paidBreakInvalid: 'Minutes de pause payee doit etre 0 ou plus.',
    exportJsonDone: 'Sauvegarde JSON exportee.',
    exportCsvDone: 'CSV des projets exporte.',
    importFailed: 'Import echoue: format invalide.',
    pullModeInvalid: 'Strategie de recuperation invalide.',
    importDone: '{count} nouveaux enregistrements importes.',
  },
}

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
  entryDateInput: document.getElementById('entryDateInput'),
  entryProjectInput: document.getElementById('entryProjectInput'),
  entryProjectDropdown: document.getElementById('entryProjectDropdown'),
  entryStartTimeInput: document.getElementById('entryStartTimeInput'),
  entryEndTimeInput: document.getElementById('entryEndTimeInput'),
  addEntryBtn: document.getElementById('addEntryBtn'),
  recentEntriesList: document.getElementById('recentEntriesList'),
  entryHint: document.getElementById('entryHint'),
  deleteEntryConfirm: document.getElementById('deleteEntryConfirm'),
  deleteEntryMessage: document.getElementById('deleteEntryMessage'),
  cancelDeleteEntryBtn: document.getElementById('cancelDeleteEntryBtn'),
  confirmDeleteEntryBtn: document.getElementById('confirmDeleteEntryBtn'),

  yearAvg: document.getElementById('yearAvg'),
  weekSoFar: document.getElementById('weekSoFar'),
  daySoFar: document.getElementById('daySoFar'),
  dayBreakBonus: document.getElementById('dayBreakBonus'),
  weekDelta: document.getElementById('weekDelta'),
  yearDelta: document.getElementById('yearDelta'),

  targetHoursInput: document.getElementById('targetHoursInput'),
  targetDaysInput: document.getElementById('targetDaysInput'),
  weekStartsOnInput: document.getElementById('weekStartsOnInput'),
  startDateInput: document.getElementById('startDateInput'),
  breakIntervalHoursInput: document.getElementById('breakIntervalHoursInput'),
  paidBreakMinutesInput: document.getElementById('paidBreakMinutesInput'),
  settingsHint: document.getElementById('settingsHint'),
  holidayDateInput: document.getElementById('holidayDateInput'),
  holidayDaysInput: document.getElementById('holidayDaysInput'),
  addHolidayBtn: document.getElementById('addHolidayBtn'),
  holidayList: document.getElementById('holidayList'),
  holidayHint: document.getElementById('holidayHint'),

  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  jsonHint: document.getElementById('jsonHint'),
  syncModeInput: document.getElementById('syncModeInput'),
  cloudPullModeInput: document.getElementById('cloudPullModeInput'),
  cloudStatus: document.getElementById('cloudStatus'),
  cloudHint: document.getElementById('cloudHint'),

  exportProjectCsvBtn: document.getElementById('exportProjectCsvBtn'),
}

init()

function init() {
  applyTranslations()
  bindEvents()
  hydrateInputs()
  ensureTicker()
  render()
  initializeFirebaseSync()
}

function t(key, vars = {}) {
  const table = I18N[UI_LANGUAGE] || I18N.en
  const fallback = I18N.en[key] || key
  const template = table[key] || fallback
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''))
}

function applyTranslations() {
  const textNodes = document.querySelectorAll('[data-i18n]')
  for (const node of textNodes) {
    const key = node.getAttribute('data-i18n')
    if (!key) {
      continue
    }
    node.textContent = t(key)
  }

  const placeholders = document.querySelectorAll('[data-i18n-placeholder]')
  for (const node of placeholders) {
    const key = node.getAttribute('data-i18n-placeholder')
    if (!key || !(node instanceof HTMLInputElement)) {
      continue
    }
    node.placeholder = t(key)
  }
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

  el.entryProjectInput.addEventListener('focus', showEntryProjectDropdown)
  el.entryProjectInput.addEventListener('input', showEntryProjectDropdown)
  el.entryProjectInput.addEventListener('blur', onEntryProjectInputBlur)
  el.entryProjectInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      onEntryProjectChanged()
    }
  })

  document.addEventListener('click', onDocumentClick)

  bindLiveSettingsEvents()
  el.exportBtn.addEventListener('click', onExportJson)
  el.exportProjectCsvBtn.addEventListener('click', onExportProjectCsv)
  el.importInput.addEventListener('change', onImportJson)
  el.addHolidayBtn.addEventListener('click', onAddHoliday)
  el.holidayList.addEventListener('click', onHolidayListClick)
  el.addEntryBtn.addEventListener('click', onAddEntry)
  el.recentEntriesList.addEventListener('click', onRecentEntriesListClick)
  el.cancelDeleteEntryBtn.addEventListener('click', closeDeleteConfirm)
  el.confirmDeleteEntryBtn.addEventListener('click', confirmDeleteEntry)
  el.deleteEntryConfirm.addEventListener('click', (event) => {
    if (event.target === el.deleteEntryConfirm) {
      closeDeleteConfirm()
    }
  })

  window.addEventListener('focus', () => {
    renderCloudStatus()
  })
}

function bindLiveSettingsEvents() {
  const onFinish = () => onSaveSettings()
  const inputs = [
    el.targetHoursInput,
    el.targetDaysInput,
    el.weekStartsOnInput,
    el.startDateInput,
    el.breakIntervalHoursInput,
    el.paidBreakMinutesInput,
    el.syncModeInput,
    el.cloudPullModeInput,
  ].filter(Boolean)

  for (const input of inputs) {
    input.addEventListener('change', onFinish)
    input.addEventListener('blur', onFinish)
  }
}

function hydrateInputs() {
  const now = new Date()
  el.targetHoursInput.value = String(state.settings.targetHoursPerWeek)
  el.targetDaysInput.value = String(state.settings.targetDaysPerWeek)
  el.weekStartsOnInput.value = String(state.settings.weekStartsOn)
  el.startDateInput.value = state.settings.trackingStartDate || ''
  if (el.syncModeInput) {
    el.syncModeInput.value = getSyncMode()
  }
  if (el.cloudPullModeInput) {
    el.cloudPullModeInput.value = getCloudPullMode()
  }
  el.breakIntervalHoursInput.value = String(state.settings.paidBreakIntervalHours)
  el.paidBreakMinutesInput.value = String(state.settings.paidBreakMinutes)
  el.holidayDateInput.value = formatDateInput(now)
  el.holidayDaysInput.value = '1'
  el.projectInput.value = state.activeSession?.project || state.lastProject || 'General'
  el.entryProjectInput.value = el.projectInput.value
  el.entryDateInput.value = formatDateInput(now)
  el.entryStartTimeInput.value = '09:00'
  el.entryEndTimeInput.value = '17:00'
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
  const rawProjectName = el.projectInput.value.trim()
  const nextProject = normalizeProjectName(rawProjectName)
  const knownProjects = new Set(
    collectProjects(state.sessions, state.activeSession, state.paidBreakAwards),
  )

  if (projectAddMode && !rawProjectName) {
    setHint(el.projectDataHint, t('typeNewProject'))
    return
  }

  if (!state.activeSession) {
    if (projectAddMode) {
      if (knownProjects.has(nextProject)) {
        projectAddMode = false
        el.projectInput.value = nextProject
        projectInputPrevious = nextProject
        state.lastProject = nextProject
        el.entryProjectInput.value = nextProject
        saveState()
        setHint(el.projectDataHint, t('alreadyExists', { project: nextProject }))
        renderProjects()
        return
      }

      projectAddMode = false
      state.lastProject = nextProject
      projectInputPrevious = nextProject
      el.entryProjectInput.value = nextProject
      saveState()
      setHint(el.projectDataHint, t('addedProject', { project: nextProject }))
      renderProjects()
      return
    }

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
        t('renamedProject', { from: previousProject, to: nextProject, count: renamedCount }),
      )
      render()
    }
    projectInputPrevious = nextProject
    state.lastProject = nextProject
    el.entryProjectInput.value = nextProject
    saveState()
    return
  }

  const currentProject = state.activeSession.project
  if (nextProject === currentProject) {
    projectAddMode = false
    projectInputPrevious = nextProject
    return
  }

  processPaidBreakAwards()
  closeActiveSession({ keepRun: true })
  startSession(nextProject, { keepRun: true })
  setHint(el.projectDataHint, t('switchedProject', { project: nextProject }))
  projectAddMode = false
  projectInputPrevious = nextProject
  el.entryProjectInput.value = nextProject
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
  if (target === el.entryProjectInput || el.entryProjectDropdown.contains(target)) {
    return
  }
  if (target instanceof Element) {
    if (
      target.closest('[data-field="project"]') ||
      target.closest('[data-field="project-dropdown"]')
    ) {
      return
    }
  }
  hideProjectDropdown()
  hideEntryProjectDropdown()
  hideAllInlineEntryProjectDropdowns()
}

function onEntryProjectInputBlur() {
  setTimeout(() => {
    onEntryProjectChanged()
    hideEntryProjectDropdown()
  }, 120)
}

function onEntryProjectChanged() {
  const rawName = el.entryProjectInput.value.trim()
  const nextProject = normalizeProjectName(rawName)
  const knownProjects = new Set(
    collectProjects(state.sessions, state.activeSession, state.paidBreakAwards),
  )

  if (entryProjectAddMode && !rawName) {
    setHint(el.entryHint, t('typeNewProject'))
    return
  }

  if (entryProjectAddMode && knownProjects.has(nextProject)) {
    setHint(el.entryHint, t('alreadyExists', { project: nextProject }))
  } else if (entryProjectAddMode) {
    setHint(el.entryHint, t('addedProject', { project: nextProject }))
  }

  entryProjectAddMode = false
  el.entryProjectInput.value = nextProject
  state.lastProject = nextProject
  saveState()
  renderProjects()
}

async function onSaveSettings() {
  const target = Number(el.targetHoursInput.value)
  const targetDays = Number(el.targetDaysInput.value)
  const weekStartsOn = Number(el.weekStartsOnInput.value)
  const trackingStartDate = el.startDateInput.value
  const syncMode = String(el.syncModeInput?.value || getSyncMode())
  const cloudPullMode = String(el.cloudPullModeInput?.value || getCloudPullMode())
  const intervalHours = Number(el.breakIntervalHoursInput.value)
  const paidBreak = Number(el.paidBreakMinutesInput.value)
  const previousSyncMode = getSyncMode()

  if (!Number.isFinite(target) || target <= 0) {
    setHint(el.settingsHint, t('targetHoursInvalid'))
    return
  }

  if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
    setHint(el.settingsHint, t('breakIntervalInvalid'))
    return
  }

  if (!Number.isFinite(targetDays) || targetDays < 1 || targetDays > 7) {
    setHint(el.settingsHint, t('targetDaysInvalid'))
    return
  }

  if (!Number.isFinite(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    setHint(el.settingsHint, t('weekStartInvalid'))
    return
  }

  if (trackingStartDate) {
    const parsedStart = parseDateOnly(trackingStartDate)
    if (!parsedStart) {
      setHint(el.settingsHint, t('trackingDateInvalid'))
      return
    }
  }

  if (!Number.isFinite(paidBreak) || paidBreak < 0) {
    setHint(el.settingsHint, t('paidBreakInvalid'))
    return
  }

  if (syncMode !== 'local' && syncMode !== 'cloud') {
    setHint(el.settingsHint, t('firebaseSyncFailed', { reason: 'Invalid sync mode' }))
    return
  }

  if (cloudPullMode !== 'remote' && cloudPullMode !== 'merge') {
    setHint(el.settingsHint, t('pullModeInvalid'))
    return
  }

  state.settings.targetHoursPerWeek = target
  state.settings.targetDaysPerWeek = Math.round(targetDays)
  state.settings.weekStartsOn = Math.round(weekStartsOn)
  state.settings.trackingStartDate = trackingStartDate || ''
  state.settings.syncMode = syncMode
  state.settings.cloudPullMode = cloudPullMode
  state.settings.paidBreakIntervalHours = intervalHours
  state.settings.paidBreakMinutes = paidBreak

  saveState({ immediatePush: false })
  renderCloudStatus()

  if (syncMode === 'cloud') {
    initializeFirebaseSync()
    if (previousSyncMode !== 'cloud' && !firebaseUser) {
      try {
        await onSignInWithGoogle()
      } catch {
        // onSignInWithGoogle already surfaces the failure.
      }
    }
  } else if (previousSyncMode === 'cloud' && firebaseAuth && firebaseUser) {
    try {
      await firebaseAuth.signOut()
    } catch {
      // Stay local even if sign-out fails; the mode gate still prevents sync.
    }
    firebaseUser = null
    renderCloudStatus()
  }

  setHint(el.settingsHint, t('settingsSaved'))
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
  setHint(el.jsonHint, t('exportJsonDone'))
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
  setHint(el.projectDataHint, t('exportCsvDone'))
}

function onAddHoliday() {
  const dateText = el.holidayDateInput.value
  const days = Number(el.holidayDaysInput.value)
  const date = parseDateOnly(dateText)

  if (!date) {
    setHint(el.holidayHint, t('holidayDateRequired'))
    return
  }

  if (!Number.isFinite(days) || days <= 0) {
    setHint(el.holidayHint, t('holidayDaysInvalid'))
    return
  }

  state.holidayCredits.push(createHolidayCredit(date.getTime(), days))
  saveState()
  render()
  setHint(
    el.holidayHint,
    `${t('holidayAdded', { date: formatDateInput(date) })} ${t('holidayHoursAdded', {
      hours: formatDuration(computeHolidayDurationMs(days)),
      days: formatHolidayDays(days),
    })}`,
  )
}

function onHolidayListClick(event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }

  const id = target.dataset.holidayId
  if (!id) {
    return
  }

  state.holidayCredits = state.holidayCredits.filter((credit) => credit.id !== id)
  saveState()
  render()
  setHint(el.holidayHint, t('holidayDeleted'))
}

async function onImportJson(event) {
  const file = event.target.files?.[0]
  if (!file) {
    return
  }

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const merged = applyImportedState(parsed)
    setHint(el.jsonHint, t('importDone', { count: merged }))
  } catch {
    setHint(el.jsonHint, t('importFailed'))
  } finally {
    event.target.value = ''
  }
}

function getCloudPullMode() {
  return state.settings.cloudPullMode === 'merge' ? 'merge' : 'remote'
}

function getSyncMode() {
  return state.settings.syncMode === 'cloud' ? 'cloud' : 'local'
}

function renderCloudStatus() {
  if (!el.cloudStatus) {
    return
  }

  const syncMode = getSyncMode()
  const statusText = syncMode === 'local'
    ? t('localModeActive')
    : firebaseUser
      ? t('cloudStatusSignedIn', {
          email: firebaseUser.email || firebaseUser.displayName || 'Google user',
        })
      : firebaseConfigReady
        ? t('cloudReconnectNeeded')
        : t('firebaseConfigMissing')

  setHint(el.cloudStatus, statusText)

  if (el.cloudPullModeInput) {
    el.cloudPullModeInput.disabled = syncMode !== 'cloud'
  }
}

function getFirebaseConfig() {
  const config = window[FIREBASE_CONFIG_GLOBAL]
  if (!config || typeof config !== 'object') {
    return null
  }

  const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']
  for (const key of requiredKeys) {
    if (!String(config[key] || '').trim()) {
      return null
    }
  }

  return config
}

function ensureFirebaseReady(options = {}) {
  const requireUser = options.requireUser !== false
  if (!firebaseConfigReady || !firebaseAuth || !firebaseDatabase) {
    throw new Error(t('firebaseConfigMissing'))
  }
  if (requireUser && !firebaseUser) {
    throw new Error(t('signInRequired'))
  }
}

function ensureFirebaseOriginSupported() {
  const protocol = String(window.location.protocol || '').toLowerCase()
  if (protocol === 'file:') {
    throw new Error(t('firebaseOriginUnsupported'))
  }
}

function getCloudStatePath(uid) {
  return `users/${uid}/timeTracker/state`
}

function initializeFirebaseSync() {
  if (firebaseAuth || getSyncMode() !== 'cloud') {
    renderCloudStatus()
    return
  }

  renderCloudStatus()

  if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
    autoSyncPullAttempted = true
    return
  }

  const config = getFirebaseConfig()
  if (!config) {
    autoSyncPullAttempted = true
    return
  }

  firebaseApp = window.firebase.apps?.length ? window.firebase.app() : window.firebase.initializeApp(config)
  firebaseAuth = window.firebase.auth()
  firebaseDatabase = window.firebase.database()
  firebaseConfigReady = true
  renderCloudStatus()

  firebaseAuth.onAuthStateChanged((user) => {
    void handleFirebaseAuthChange(user)
  })
}

async function handleFirebaseAuthChange(user) {
  firebaseUser = user
  renderCloudStatus()

  if (getSyncMode() !== 'cloud') {
    autoSyncPullAttempted = true
    return
  }

  if (!user) {
    autoSyncPullAttempted = true
    return
  }

  autoSyncPullAttempted = false
  try {
    const remoteState = await downloadCloudState(user.uid)
    if (!remoteState) {
      await uploadCloudState(getSerializableState(), user.uid)
      setHint(el.cloudHint, t('cloudInitialUploadDone'))
      return
    }

    if (getCloudPullMode() === 'remote') {
      backupLocalSnapshot('pre-auto-remote-replace')
      replaceLocalStateFromRemote(remoteState, { suppressAutoPush: true })
    } else {
      applyImportedState(remoteState, { suppressAutoPush: true })
    }
  } catch (error) {
    setHint(el.cloudHint, t('firebaseSyncFailed', { reason: error.message }))
  } finally {
    autoSyncPullAttempted = true
    renderCloudStatus()
    if (autoSyncPushPending) {
      scheduleAutoSyncPush()
    }
  }

}

async function onSignInWithGoogle() {
  try {
    if (getSyncMode() !== 'cloud') {
      throw new Error(t('signInRequired'))
    }
    ensureFirebaseOriginSupported()
    initializeFirebaseSync()
    ensureFirebaseReady({ requireUser: false })
    const provider = new window.firebase.auth.GoogleAuthProvider()
    await firebaseAuth.signInWithPopup(provider)
    setHint(el.cloudHint, t('firebaseConnected'))
  } catch (error) {
    setHint(el.cloudHint, t('firebaseSyncFailed', { reason: error.message }))
  }
}

function applyImportedStateInternal(input, options = {}) {
  const suppressAutoPush = Boolean(options.suppressAutoPush)
  const hasImportedSyncMode = Boolean(
    input?.settings && Object.prototype.hasOwnProperty.call(input.settings, 'syncMode'),
  )
  const hasImportedCloudPullMode = Boolean(
    input?.settings && Object.prototype.hasOwnProperty.call(input.settings, 'cloudPullMode'),
  )
  const currentSyncMode = getSyncMode()
  const currentCloudPullMode = getCloudPullMode()
  const imported = normalizeImportedState(input)
  isApplyingRemoteState = suppressAutoPush
  try {
    state.settings = {
      ...state.settings,
      ...imported.settings,
    }

    if (!hasImportedSyncMode) {
      state.settings.syncMode = currentSyncMode
    }

    if (!hasImportedCloudPullMode) {
      state.settings.cloudPullMode = currentCloudPullMode
    }

    const mergedSessions = mergeById(state.sessions, imported.sessions)
    const mergedAwards = mergeById(state.paidBreakAwards, imported.paidBreakAwards)
    const mergedHolidays = mergeById(state.holidayCredits, imported.holidayCredits)

    if (!state.activeSession && imported.activeSession) {
      state.activeSession = imported.activeSession
      state.activeRunStart = imported.activeRunStart || imported.activeSession.start
      state.activeBreaksGranted = Number.isFinite(Number(imported.activeBreaksGranted))
        ? Number(imported.activeBreaksGranted)
        : 0
      state.lastProject =
        imported.lastProject || imported.activeSession.project || state.lastProject
      ensureTicker()
    }

    saveState()
    hydrateInputs()
    render()
    return mergedSessions + mergedAwards + mergedHolidays
  } finally {
    isApplyingRemoteState = false
  }
}

function applyImportedState(input, options = {}) {
  return applyImportedStateInternal(input, options)
}

function replaceLocalStateFromRemote(input, options = {}) {
  const suppressAutoPush = Boolean(options.suppressAutoPush)
  const hasImportedSyncMode = Boolean(
    input?.settings && Object.prototype.hasOwnProperty.call(input.settings, 'syncMode'),
  )
  const hasImportedCloudPullMode = Boolean(
    input?.settings && Object.prototype.hasOwnProperty.call(input.settings, 'cloudPullMode'),
  )
  const currentSyncMode = getSyncMode()
  const currentCloudPullMode = getCloudPullMode()
  const nextState = normalizeImportedState(input)
  if (!hasImportedSyncMode) {
    nextState.settings.syncMode = currentSyncMode
  }
  if (!hasImportedCloudPullMode) {
    nextState.settings.cloudPullMode = currentCloudPullMode
  }

  isApplyingRemoteState = suppressAutoPush
  try {
    state = nextState
    projectInputPrevious = state.activeSession?.project || state.lastProject || 'General'
    saveState()
    hydrateInputs()
    ensureTicker()
    render()
  } finally {
    isApplyingRemoteState = false
  }
}

function backupLocalSnapshot(reason) {
  try {
    const backup = {
      reason,
      backupAt: Date.now(),
      snapshot: getSerializableState(),
    }
    localStorage.setItem(`${STORAGE_KEY}-local-backup`, JSON.stringify(backup))
  } catch {
    // Ignore backup write failures; pull still proceeds.
  }
}

async function runAutoSyncPullOnInit() {
  if (!firebaseUser) {
    autoSyncPullAttempted = true
    return
  }

  try {
    const remoteState = await downloadCloudState(firebaseUser.uid)
    if (!remoteState) {
      autoSyncPullAttempted = true
      return
    }

    if (getCloudPullMode() === 'remote') {
      backupLocalSnapshot('pre-auto-remote-replace')
      replaceLocalStateFromRemote(remoteState, { suppressAutoPush: true })
    } else {
      applyImportedState(remoteState, { suppressAutoPush: true })
    }
  } catch {
    // Keep silent on automatic pull failures; manual pull remains available.
  } finally {
    autoSyncPullAttempted = true
    if (autoSyncPushPending) {
      scheduleAutoSyncPush()
    }
  }
}

function scheduleAutoSyncPush(options = {}) {
  const immediate = Boolean(options.immediate)

  if (getSyncMode() !== 'cloud' || isApplyingRemoteState || !firebaseUser) {
    return
  }

  autoSyncPushPending = true
  if (autoSyncPushTimer) {
    clearTimeout(autoSyncPushTimer)
    autoSyncPushTimer = null
  }

  if (immediate) {
    void flushAutoSyncPush()
    return
  }

  autoSyncPushTimer = setTimeout(() => {
    autoSyncPushTimer = null
    void flushAutoSyncPush()
  }, 1500)
}

async function flushAutoSyncPush() {
  if (!autoSyncPushPending || !firebaseUser || autoSyncPushInFlight) {
    return
  }
  if (!autoSyncPullAttempted) {
    return
  }

  autoSyncPushPending = false
  autoSyncPushInFlight = true
  try {
    await uploadCloudState(getSerializableState(), firebaseUser.uid)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()))
  } catch (error) {
    setHint(el.cloudHint, t('firebaseSyncFailed', { reason: error.message }))
  } finally {
    autoSyncPushInFlight = false
    if (autoSyncPushPending) {
      scheduleAutoSyncPush()
    }
  }
}

function getSerializableState() {
  return {
    version: APP_VERSION,
    settings: state.settings,
    sessions: state.sessions,
    paidBreakAwards: state.paidBreakAwards,
    activeSession: state.activeSession,
    lastProject: state.lastProject,
    activeRunStart: state.activeRunStart,
    activeBreaksGranted: state.activeBreaksGranted,
    updatedAt: Date.now(),
  }
}
async function downloadCloudState(uid) {
  ensureFirebaseReady({ requireUser: false })
  const snapshot = await firebaseDatabase.ref(getCloudStatePath(uid)).once('value')
  return snapshot.exists() ? snapshot.val() : null
}

async function uploadCloudState(snapshot, uid) {
  ensureFirebaseReady({ requireUser: false })
  await firebaseDatabase.ref(getCloudStatePath(uid)).set(snapshot)
}

function onAddEntry() {
  const dateText = el.entryDateInput.value
  const startText = el.entryStartTimeInput.value
  const endText = el.entryEndTimeInput.value.trim()
  const project = normalizeProjectName(el.entryProjectInput.value)

  if (!dateText || !startText) {
    setHint(el.entryHint, t('dateStartRequired'))
    return
  }

  const startMs = parseDateTimeInput(dateText, startText)
  if (!Number.isFinite(startMs)) {
    setHint(el.entryHint, t('startInvalid'))
    return
  }

  if (startMs > Date.now()) {
    setHint(el.entryHint, t('startFuture'))
    return
  }

  const windowStart = getRecentWindowStart(new Date()).getTime()
  if (startMs < windowStart) {
    setHint(el.entryHint, t('outside14'))
    return
  }

  if (!endText) {
    if (state.activeSession) {
      setHint(el.entryHint, t('runningAlready'))
      return
    }

    startManualActiveSession(startMs, project)
    setHint(el.entryHint, t('startedRunning', { project }))
    render()
    return
  }

  const endMs = parseDateTimeInput(dateText, endText)
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    setHint(el.entryHint, t('endAfterStart'))
    return
  }

  if (endMs > Date.now()) {
    setHint(el.entryHint, t('endFuture'))
    return
  }

  state.sessions.push(createClosedSession(startMs, endMs, project))
  addPaidBreakAwardsForRange(startMs, endMs, project)
  state.lastProject = project
  el.projectInput.value = project
  el.entryProjectInput.value = project
  projectInputPrevious = project
  openEntryEditorId = null
  saveState()
  setHint(el.entryHint, t('addedEntry', { project }))
  render()
}

function onRecentEntriesListClick(event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }

  const action = target.dataset.action
  const id = target.dataset.id
  if (!action || !id) {
    return
  }

  if (action === 'edit') {
    openEntryEditorId = openEntryEditorId === id ? null : id
    renderRecentEntries(new Date())
  } else if (action === 'pick-inline-project') {
    const value = target.dataset.value || ''
    selectInlineEntryProject(id, value)
  } else if (action === 'cancel-edit') {
    openEntryEditorId = null
    renderRecentEntries(new Date())
  } else if (action === 'save-edit') {
    saveEditedEntry(id)
  } else if (action === 'delete') {
    openDeleteConfirm(id)
  }
}

function saveEditedEntry(id) {
  const row = el.recentEntriesList.querySelector(`[data-entry-id="${id}"]`)
  if (!row) {
    return
  }

  const dateInput = row.querySelector('[data-field="date"]')
  const projectInput = row.querySelector('[data-field="project"]')
  const startInput = row.querySelector('[data-field="start"]')
  const endInput = row.querySelector('[data-field="end"]')

  if (!dateInput || !projectInput || !startInput || !endInput) {
    return
  }

  const dateText = dateInput.value
  const startText = startInput.value
  const endText = endInput.value.trim()
  const rawProject = projectInput.value.trim()
  const project = normalizeProjectName(rawProject)
  if (projectInput.dataset.addMode === 'true' && !rawProject) {
    setHint(el.entryHint, t('typeNewProject'))
    return
  }

  if (!dateText || !startText) {
    setHint(el.entryHint, t('editDateStartRequired'))
    return
  }

  const nextStart = parseDateTimeInput(dateText, startText)
  if (!Number.isFinite(nextStart)) {
    setHint(el.entryHint, t('editStartInvalid'))
    return
  }

  if (nextStart > Date.now()) {
    setHint(el.entryHint, t('editStartFuture'))
    return
  }

  const windowStart = getRecentWindowStart(new Date()).getTime()
  if (nextStart < windowStart) {
    setHint(el.entryHint, t('editOutside14'))
    return
  }

  if (id === getRunningEntryId()) {
    if (endText) {
      const nextEnd = parseDateTimeInput(dateText, endText)
      if (!Number.isFinite(nextEnd) || nextEnd <= nextStart) {
        setHint(el.entryHint, t('editEndAfterStart'))
        return
      }
      if (nextEnd > Date.now()) {
        setHint(el.entryHint, t('editEndFuture'))
        return
      }
      stopManualActiveSession(nextStart, nextEnd, project)
      setHint(el.entryHint, t('runningSaved'))
    } else {
      updateActiveSessionStart(nextStart, project)
      setHint(el.entryHint, t('runningUpdated'))
    }
  } else {
    const nextEnd = parseDateTimeInput(dateText, endText)
    if (!Number.isFinite(nextEnd) || nextEnd <= nextStart) {
      setHint(el.entryHint, t('editEndAfterStart'))
      return
    }
    if (nextEnd > Date.now()) {
      setHint(el.entryHint, t('editEndFuture'))
      return
    }
    updateClosedSession(id, nextStart, nextEnd, project)
    setHint(el.entryHint, t('entryUpdated'))
  }

  openEntryEditorId = null
  saveState()
  render()
}

function openDeleteConfirm(id) {
  const entry = getEntryById(id)
  if (!entry) {
    return
  }
  pendingDeleteEntryId = id
  el.deleteEntryMessage.textContent = `${entry.project} • ${formatEntryRange(
    entry.start,
    entry.end,
    entry.isRunning,
  )}`
  el.deleteEntryConfirm.classList.add('open')
  el.deleteEntryConfirm.setAttribute('aria-hidden', 'false')
}

function closeDeleteConfirm() {
  pendingDeleteEntryId = null
  el.deleteEntryConfirm.classList.remove('open')
  el.deleteEntryConfirm.setAttribute('aria-hidden', 'true')
}

function confirmDeleteEntry() {
  if (!pendingDeleteEntryId) {
    closeDeleteConfirm()
    return
  }

  if (pendingDeleteEntryId === getRunningEntryId()) {
    clearActiveRunAwards()
    state.activeSession = null
    state.activeRunStart = null
    state.activeBreaksGranted = 0
    ensureTicker()
  } else {
    state.sessions = state.sessions.filter((item) => item.id !== pendingDeleteEntryId)
  }

  openEntryEditorId = null
  saveState()
  closeDeleteConfirm()
  setHint(el.entryHint, t('entryDeleted'))
  render()
}

function renderRecentEntries(now) {
  const rows = getRecentEntries(now)

  el.recentEntriesList.innerHTML = ''

  if (!rows.length) {
    const empty = document.createElement('p')
    empty.className = 'hint'
    empty.textContent = t('noEntries14')
    el.recentEntriesList.appendChild(empty)
    return
  }

  for (const row of rows) {
    const card = document.createElement('article')
    card.className = 'recent-entry-row'
    card.dataset.entryId = row.id
    const isOpen = openEntryEditorId === row.id

    const runningTag = row.isRunning
      ? `<span class="recent-entry-running">${escapeHtml(t('runningTag'))}</span>`
      : ''
    const endValue = row.isRunning ? '' : formatTimeInput(new Date(row.end))

    card.innerHTML = `
      <div class="recent-entry-main">
        <div class="recent-entry-project">${escapeHtml(row.project)} ${runningTag}</div>
        <div class="recent-entry-time">${escapeHtml(
          formatEntryRange(row.start, row.end, row.isRunning),
        )}</div>
      </div>
      <div class="recent-entry-actions">
        <button class="btn" type="button" data-action="${
          isOpen ? 'save-edit' : 'edit'
        }" data-id="${escapeHtml(row.id)}">${isOpen ? t('save') : t('edit')}</button>
        <button class="btn ${isOpen ? '' : 'btn-danger'}" type="button" data-action="${
      isOpen ? 'cancel-edit' : 'delete'
    }" data-id="${escapeHtml(row.id)}">${isOpen ? t('cancel') : t('delete')}</button>
      </div>
      <div class="entry-edit-panel ${isOpen ? 'open' : ''}">
        <div class="entry-edit-grid">
          <label class="field">
            <span>${escapeHtml(t('date'))}</span>
            <input data-field="date" type="date" value="${formatDateInput(new Date(row.start))}" />
          </label>
          <label class="field">
            <span>${escapeHtml(t('project'))}</span>
            <div class="project-input-wrap">
              <input data-field="project" type="text" maxlength="80" value="${escapeHtml(
                row.project,
              )}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
              <div class="project-dropdown" data-field="project-dropdown" role="listbox"></div>
            </div>
          </label>
          <label class="field">
            <span>${escapeHtml(t('startTime'))}</span>
            <input data-field="start" type="time" step="60" value="${formatTimeInput(
              new Date(row.start),
            )}" />
          </label>
          <label class="field">
            <span>${escapeHtml(row.isRunning ? t('endTimeOptional') : t('endTime'))}</span>
            <input data-field="end" type="time" step="60" value="${endValue}" />
          </label>
        </div>
      </div>
    `
    el.recentEntriesList.appendChild(card)

    if (isOpen) {
      renderInlineEntryProjectOptions(card, row.id)
      bindInlineEntryProjectInput(card, row.id)
    }
  }
}

function bindInlineEntryProjectInput(card, rowId) {
  const input = card.querySelector('[data-field="project"]')
  if (!input) {
    return
  }

  input.addEventListener('focus', () => showInlineEntryProjectDropdown(rowId))
  input.addEventListener('input', () => showInlineEntryProjectDropdown(rowId))
  input.addEventListener('blur', () => {
    setTimeout(() => hideInlineEntryProjectDropdown(rowId), 120)
  })
}

function renderInlineEntryProjectOptions(card, rowId) {
  const dropdown = card.querySelector('[data-field="project-dropdown"]')
  if (!dropdown) {
    return
  }

  const projects = getProjectsByLastUse(state.sessions, state.activeSession, state.paidBreakAwards)
  dropdown.innerHTML = ''

  const addOption = document.createElement('button')
  addOption.type = 'button'
  addOption.className = 'project-option project-option-addnew'
  addOption.textContent = t('addNewProject')
  addOption.dataset.action = 'pick-inline-project'
  addOption.dataset.id = rowId
  addOption.dataset.value = PROJECT_ADD_NEW_TOKEN
  dropdown.appendChild(addOption)

  for (const project of projects) {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = 'project-option'
    option.textContent = project
    option.dataset.action = 'pick-inline-project'
    option.dataset.id = rowId
    option.dataset.value = project
    dropdown.appendChild(option)
  }
}

function showInlineEntryProjectDropdown(rowId) {
  const row = el.recentEntriesList.querySelector(`[data-entry-id="${rowId}"]`)
  if (!row) {
    return
  }
  const dropdown = row.querySelector('[data-field="project-dropdown"]')
  if (!dropdown) {
    return
  }
  dropdown.classList.add('open')
}

function hideInlineEntryProjectDropdown(rowId) {
  const row = el.recentEntriesList.querySelector(`[data-entry-id="${rowId}"]`)
  if (!row) {
    return
  }
  const dropdown = row.querySelector('[data-field="project-dropdown"]')
  if (!dropdown) {
    return
  }
  dropdown.classList.remove('open')
}

function selectInlineEntryProject(rowId, value) {
  const row = el.recentEntriesList.querySelector(`[data-entry-id="${rowId}"]`)
  if (!row) {
    return
  }

  const input = row.querySelector('[data-field="project"]')
  if (!input) {
    return
  }

  if (value === PROJECT_ADD_NEW_TOKEN) {
    input.dataset.addMode = 'true'
    input.value = ''
    setHint(el.entryHint, t('typeNewProject'))
    showInlineEntryProjectDropdown(rowId)
    input.focus()
    return
  }

  input.dataset.addMode = 'false'
  input.value = value
  hideInlineEntryProjectDropdown(rowId)
}

function getRecentEntries(now) {
  const startMs = getRecentWindowStart(now).getTime()
  const rows = state.sessions
    .filter((session) => session.start >= startMs)
    .map((session) => ({ ...session, isRunning: false }))

  if (state.activeSession && state.activeSession.start >= startMs) {
    rows.push({
      id: getRunningEntryId(),
      start: state.activeSession.start,
      end: Date.now(),
      project: state.activeSession.project,
      isRunning: true,
    })
  }

  return rows.sort((a, b) => b.start - a.start)
}

function getRunningEntryId() {
  return '__running__'
}

function getEntryById(id) {
  if (id === getRunningEntryId()) {
    if (!state.activeSession) {
      return null
    }
    return {
      id,
      start: state.activeSession.start,
      end: Date.now(),
      project: state.activeSession.project,
      isRunning: true,
    }
  }

  const session = state.sessions.find((item) => item.id === id)
  if (!session) {
    return null
  }
  return { ...session, isRunning: false }
}

function setOverlayOpen(node, isOpen) {
  node.classList.toggle('open', isOpen)
  node.setAttribute('aria-hidden', String(!isOpen))
}

window.timeTrackerSetOverlayOpen = function timeTrackerSetOverlayOpen(which, isOpen) {
  if (which === 'project' && el.projectOverlay) {
    setOverlayOpen(el.projectOverlay, Boolean(isOpen))
    return
  }

  if (which === 'settings' && el.settingsOverlay) {
    setOverlayOpen(el.settingsOverlay, Boolean(isOpen))
  }
}

function startSession(project, options = {}) {
  const now = Date.now()
  const keepRun = Boolean(options.keepRun)
  const nextProject = normalizeProjectName(project)

  if (!keepRun || !state.activeRunStart) {
    state.activeRunStart = now
    state.activeBreaksGranted = 0
  }

  state.activeSession = {
    id: createId(),
    start: now,
    project: nextProject,
  }

  state.lastProject = nextProject
  el.entryProjectInput.value = nextProject

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

function createClosedSession(startMs, endMs, project) {
  return {
    id: createId(),
    start: startMs,
    end: endMs,
    project,
    durationMs: Math.max(0, endMs - startMs),
  }
}

function addPaidBreakAwardsForRange(startMs, endMs, project) {
  const intervalMs = state.settings.paidBreakIntervalHours * 60 * 60 * 1000
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return
  }

  const awardDurationMs = state.settings.paidBreakMinutes * 60 * 1000
  const count = Math.floor(Math.max(0, endMs - startMs) / intervalMs)
  for (let i = 1; i <= count; i += 1) {
    state.paidBreakAwards.push({
      id: createId(),
      at: startMs + i * intervalMs,
      project,
      durationMs: awardDurationMs,
    })
  }
}

function startManualActiveSession(startMs, project) {
  state.activeSession = {
    id: createId(),
    start: startMs,
    project,
  }
  state.activeRunStart = startMs
  state.activeBreaksGranted = 0
  state.lastProject = project
  processPaidBreakAwards()
  saveState()
  ensureTicker()
}

function stopManualActiveSession(startMs, endMs, project) {
  clearActiveRunAwards()
  state.sessions.push(createClosedSession(startMs, endMs, project))
  addPaidBreakAwardsForRange(startMs, endMs, project)
  state.activeSession = null
  state.activeRunStart = null
  state.activeBreaksGranted = 0
  state.lastProject = project
  ensureTicker()
}

function updateActiveSessionStart(startMs, project) {
  if (!state.activeSession) {
    return
  }

  clearActiveRunAwards()
  state.activeSession.start = startMs
  state.activeSession.project = project
  state.activeRunStart = startMs
  state.activeBreaksGranted = 0
  state.lastProject = project
  processPaidBreakAwards()
  ensureTicker()
}

function clearActiveRunAwards() {
  if (!state.activeRunStart || !state.activeSession) {
    return
  }

  const runStart = state.activeRunStart
  const runProject = state.activeSession.project
  state.paidBreakAwards = state.paidBreakAwards.filter((award) => {
    if (award.project !== runProject) {
      return true
    }
    return award.at < runStart
  })
}

function updateClosedSession(id, startMs, endMs, project) {
  const session = state.sessions.find((item) => item.id === id)
  if (!session) {
    return
  }

  session.start = startMs
  session.end = endMs
  session.project = project
  session.durationMs = Math.max(0, endMs - startMs)
  state.lastProject = project
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

  let didChange = false
  while (state.activeBreaksGranted < shouldHaveGranted) {
    state.activeBreaksGranted += 1
    const awardTime = state.activeRunStart + state.activeBreaksGranted * intervalMs

    state.paidBreakAwards.push({
      id: createId(),
      at: awardTime,
      project: state.activeSession.project,
      durationMs: state.settings.paidBreakMinutes * 60 * 1000,
    })
    didChange = true
  }

  if (didChange) {
    saveState()
  }
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
  renderRecentEntries(new Date())
  renderHolidayCredits()

  const running = Boolean(state.activeSession)
  el.startStopBtn.textContent = running ? t('clockOut') : t('clockIn')
}

function renderHolidayCredits() {
  if (!el.holidayList) {
    return
  }

  el.holidayList.innerHTML = ''
  const rows = [...state.holidayCredits].sort((a, b) => b.at - a.at)

  if (!rows.length) {
    const empty = document.createElement('p')
    empty.className = 'hint'
    empty.textContent = t('noHolidays')
    el.holidayList.appendChild(empty)
    return
  }

  for (const credit of rows) {
    const row = document.createElement('article')
    row.className = 'holiday-row'
    row.innerHTML = `
      <div>
        <div class="holiday-row-date">${escapeHtml(formatDateInput(new Date(credit.at)))}</div>
        <div class="holiday-row-meta">${escapeHtml(
          t('holidayHoursAdded', {
            hours: formatDuration(credit.durationMs),
            days: formatHolidayDays(credit.days),
          }),
        )}</div>
      </div>
      <button class="btn btn-danger" type="button" data-holiday-id="${escapeHtml(credit.id)}" data-i18n="delete">${t(
        'delete',
      )}</button>
    `
    el.holidayList.appendChild(row)
  }
}

function renderProjects() {
  const projects = getProjectsByLastUse(state.sessions, state.activeSession, state.paidBreakAwards)
  renderProjectOptionsList(el.projectDropdown, projects, selectProjectFromDropdown)
  renderProjectOptionsList(el.entryProjectDropdown, projects, selectEntryProjectFromDropdown)
}

function renderProjectOptionsList(dropdownNode, projects, onSelect) {
  dropdownNode.innerHTML = ''

  const addOption = document.createElement('button')
  addOption.type = 'button'
  addOption.className = 'project-option project-option-addnew'
  addOption.textContent = t('addNewProject')
  addOption.setAttribute('role', 'option')
  addOption.addEventListener('mousedown', (event) => {
    event.preventDefault()
    onSelect(PROJECT_ADD_NEW_TOKEN)
  })
  dropdownNode.appendChild(addOption)

  for (const project of projects) {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = 'project-option'
    option.textContent = project
    option.setAttribute('role', 'option')
    option.addEventListener('mousedown', (event) => {
      event.preventDefault()
      onSelect(project)
    })
    dropdownNode.appendChild(option)
  }
}

function selectProjectFromDropdown(project) {
  if (project === PROJECT_ADD_NEW_TOKEN) {
    projectAddMode = true
    el.projectInput.value = ''
    projectInputPrevious = ''
    setHint(el.projectDataHint, t('typeNewProject'))
    showProjectDropdown()
    el.projectInput.focus()
    return
  }

  projectAddMode = false
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

function selectEntryProjectFromDropdown(project) {
  if (project === PROJECT_ADD_NEW_TOKEN) {
    entryProjectAddMode = true
    el.entryProjectInput.value = ''
    setHint(el.entryHint, t('typeNewProject'))
    showEntryProjectDropdown()
    el.entryProjectInput.focus()
    return
  }

  entryProjectAddMode = false
  el.entryProjectInput.value = project
  onEntryProjectChanged()
  hideEntryProjectDropdown()
}

function showEntryProjectDropdown() {
  if (!el.entryProjectDropdown.children.length) {
    return
  }
  el.entryProjectDropdown.classList.add('open')
}

function hideEntryProjectDropdown() {
  el.entryProjectDropdown.classList.remove('open')
}

function hideAllInlineEntryProjectDropdowns() {
  const dropdowns = el.recentEntriesList.querySelectorAll('[data-field="project-dropdown"]')
  for (const dropdown of dropdowns) {
    dropdown.classList.remove('open')
  }
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
  const currentWeekStart = startOfWeek(now, state.settings.weekStartsOn)
  const day = computeRangeTotalMs(startOfDay(now), now)
  const week = computeRangeTotalMs(currentWeekStart, now)

  const trackingStart = resolveTrackingStart(now)
  const completedWindowEnd = currentWeekStart
  const hasCompletedWindow = completedWindowEnd.getTime() > trackingStart.getTime()
  const totalSinceStart = hasCompletedWindow
    ? computeRangeTotalMs(trackingStart, completedWindowEnd)
    : 0
  const activeWeeks = hasCompletedWindow
    ? countActiveWeeks(trackingStart, completedWindowEnd, state.settings.weekStartsOn)
    : 0
  const avgYearWeek = activeWeeks > 0 ? totalSinceStart / activeWeeks : 0
  const weekTargetMs = state.settings.targetHoursPerWeek * 60 * 60 * 1000
  const weekDeltaMs = week - weekTargetMs

  const elapsedTargetDays = hasCompletedWindow
    ? computeElapsedTargetDays(
        trackingStart,
        completedWindowEnd,
        state.settings.targetDaysPerWeek,
        state.settings.weekStartsOn,
      )
    : 0
  const targetSinceStartMs = elapsedTargetDays * (weekTargetMs / state.settings.targetDaysPerWeek)
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
  return (
    computeSessionRangeMs(startDate, endDate) +
    computeAwardRangeMs(startDate, endDate) +
    computeHolidayRangeMs(startDate, endDate)
  )
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

function computeHolidayRangeMs(startDate, endDate) {
  const startMs = startDate ? startDate.getTime() : Number.MIN_SAFE_INTEGER
  const endMs = endDate.getTime()

  let total = 0
  for (const credit of state.holidayCredits) {
    if (credit.at >= startMs && credit.at <= endMs) {
      total += credit.durationMs
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

  for (const credit of state.holidayCredits) {
    if (credit.at < startDate.getTime() || credit.at > endDate.getTime()) {
      continue
    }
    const weekStart = startOfWeek(new Date(credit.at), weekStartsOn)
    keys.add(dayKey(weekStart))
  }

  return keys.size
}

function getProjectInput() {
  return normalizeProjectName(el.projectInput.value)
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

function computeElapsedTargetDays(startDate, endDate, targetDaysPerWeek, weekStartsOn) {
  const dayMs = 24 * 60 * 60 * 1000
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  if (endMs <= startMs) {
    return 0
  }

  const safeTargetDays = Math.max(1, Math.min(7, Math.round(targetDaysPerWeek || 5)))
  let cursor = startOfDay(startDate)
  let total = 0

  while (cursor.getTime() < endMs) {
    const next = new Date(cursor.getTime() + dayMs)
    const overlapStart = Math.max(cursor.getTime(), startMs)
    const overlapEnd = Math.min(next.getTime(), endMs)

    if (overlapEnd > overlapStart) {
      const dayIndexInWeek = (cursor.getDay() - weekStartsOn + 7) % 7
      if (dayIndexInWeek < safeTargetDays) {
        total += (overlapEnd - overlapStart) / dayMs
      }
    }

    cursor = next
  }

  return total
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

function parseDateTimeInput(dateText, timeText) {
  const date = parseDateOnly(dateText)
  if (!date) {
    return NaN
  }

  const match = /^(\d{2}):(\d{2})$/.exec(timeText || '')
  if (!match) {
    return NaN
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return NaN
  }

  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result.getTime()
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatTimeInput(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatEntryRange(startMs, endMs, isRunning = false) {
  const start = new Date(startMs)
  if (isRunning) {
    return `${formatDateInput(start)} ${formatTimeInput(start)}-${t(
      'runningWord',
    )} (${formatDuration(Date.now() - startMs)})`
  }

  const end = new Date(endMs)
  return `${formatDateInput(start)} ${formatTimeInput(start)}-${formatTimeInput(
    end,
  )} (${formatDuration(endMs - startMs)})`
}

function getRecentWindowStart(now) {
  const start = startOfDay(now)
  start.setDate(start.getDate() - 13)
  return start
}

function normalizeProjectName(value) {
  const name = String(value || '').trim()
  return name || 'General'
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

function formatHolidayDays(days) {
  return Number.isInteger(days) ? String(days) : String(days)
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function computeHolidayDurationMs(days) {
  const dailyHours = state.settings.targetHoursPerWeek / state.settings.targetDaysPerWeek
  return Math.max(0, dailyHours * days * 60 * 60 * 1000)
}

function createHolidayCredit(at, days) {
  return {
    id: createId(),
    at,
    days,
    durationMs: computeHolidayDurationMs(days),
  }
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
  if (state.lastProject) {
    latestByProject.set(state.lastProject, Date.now() - 1)
  }

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

function saveState(options = {}) {
  const immediatePush = options.immediatePush !== false

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: APP_VERSION,
      settings: state.settings,
      sessions: state.sessions,
      paidBreakAwards: state.paidBreakAwards,
      holidayCredits: state.holidayCredits,
      activeSession: state.activeSession,
      lastProject: state.lastProject,
      activeRunStart: state.activeRunStart,
      activeBreaksGranted: state.activeBreaksGranted,
      updatedAt: Date.now(),
    }),
  )

  scheduleAutoSyncPush({ immediate: immediatePush })
}

function defaultState() {
  return {
    version: APP_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    paidBreakAwards: [],
    holidayCredits: [],
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
    targetDaysPerWeek: Number.isFinite(Number(input?.settings?.targetDaysPerWeek))
      ? Math.max(1, Math.min(7, Math.round(Number(input.settings.targetDaysPerWeek))))
      : DEFAULT_SETTINGS.targetDaysPerWeek,
    weekStartsOn: Number.isFinite(Number(input?.settings?.weekStartsOn))
      ? Math.max(0, Math.min(6, Math.round(Number(input.settings.weekStartsOn))))
      : DEFAULT_SETTINGS.weekStartsOn,
    paidBreakIntervalHours: Number.isFinite(Number(input?.settings?.paidBreakIntervalHours))
      ? Number(input.settings.paidBreakIntervalHours)
      : inferredHours || DEFAULT_SETTINGS.paidBreakIntervalHours,
    syncMode: input?.settings?.syncMode === 'cloud' ? 'cloud' : DEFAULT_SETTINGS.syncMode,
    cloudPullMode:
      input?.settings?.cloudPullMode === 'merge' || input?.settings?.cloudPullMode === 'remote'
        ? input.settings.cloudPullMode
        : input?.settings?.googlePullMode === 'merge' || input?.settings?.googlePullMode === 'remote'
          ? input.settings.googlePullMode
          : DEFAULT_SETTINGS.cloudPullMode,
  }

  const sessions = Array.isArray(input.sessions)
    ? input.sessions
        .map(normalizeSession)
        .filter((session) => session && session.end > session.start)
    : []

  const paidBreakAwards = Array.isArray(input.paidBreakAwards)
    ? input.paidBreakAwards.map(normalizeAward).filter((award) => award && award.durationMs >= 0)
    : []

  const holidayCredits = Array.isArray(input.holidayCredits)
    ? input.holidayCredits
        .map(normalizeHolidayCredit)
        .filter((credit) => credit && credit.durationMs >= 0)
    : []

  const activeSession = normalizeActiveSession(input.activeSession)

  return {
    version: APP_VERSION,
    settings,
    sessions,
    paidBreakAwards,
    holidayCredits,
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
  migrated.settings.targetDaysPerWeek = 5
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

function normalizeHolidayCredit(credit) {
  if (!credit || typeof credit !== 'object') {
    return null
  }

  const at = Number(credit.at)
  const days = Number(credit.days)
  const durationMs = Number(credit.durationMs)
  if (!Number.isFinite(at) || !Number.isFinite(days) || !Number.isFinite(durationMs)) {
    return null
  }

  return {
    id: typeof credit.id === 'string' ? credit.id : createId(),
    at,
    days,
    durationMs: Math.max(0, durationMs),
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
