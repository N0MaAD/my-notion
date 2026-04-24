import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useWorkspaceStore } from './workspace.js'

export const NOTE_TYPES = {
  note:  { id: 'note',  label: 'Note',   icon: '📄', color: null,      description: 'Note classique' },
  task:  { id: 'task',  label: 'Tâche',  icon: '☑️', color: '#3b82f6', description: 'Tâche avec case à cocher' },
  date:  { id: 'date',  label: 'Date',   icon: '📅', color: '#f59e0b', description: 'Deadline ou periode' },
  idea:  { id: 'idea',  label: 'Idée',   icon: '💡', color: '#a855f7', description: 'Idée / brainstorm' },
  bug:   { id: 'bug',   label: 'Bug',    icon: '🐛', color: '#ef4444', description: 'Bug / problème' },
  link:  { id: 'link',  label: 'Lien',   icon: '🔗', color: '#06b6d4', description: 'Lien / ressource' }
}

export const useBoardStore = defineStore('board', () => {
  const columns       = ref([])
  const trash         = ref([])
  const tags          = ref([])
  const activeNoteId  = ref(null)
  const openPagePath  = ref([])
  const pinnedNoteIds = ref([])
  const dataLoaded    = ref(false)
  const notifications = ref([])

  // Internal map: columnId → workspaceId (not persisted to Firestore)
  const columnWorkspaceMap = ref({})

  const TRASH_RETENTION_DAYS = 30

  let saveTimeout = null
  let notifId = 0
  let isRemoteUpdate = false
  const snapshotUnsubscribers = {}
  let lastSavedJson = {}

  // ─── Helpers ───
  function isPermanentColumn(columnId) {
    const col = columns.value.find(c => c.id === columnId)
    return col?.permanent === true
  }
  function getColumnWsId(columnId) {
    const wsStore = useWorkspaceStore()
    return columnWorkspaceMap.value[columnId] || wsStore.primaryWorkspaceId
  }
  function findColumnOfNote(noteId) {
    for (const col of columns.value) {
      if (col.notes.some(n => n.id === noteId)) return col
    }
    return null
  }
  // Strip internal _ws* fields before persisting
  function cleanCol(col) {
    const { _wsId, _wsIcon, _wsName, ...clean } = col
    return clean
  }
  function cleanItem(item) {
    const { _wsId, ...clean } = item
    return clean
  }

  // ─── Undo / Redo ───
  const HISTORY_LIMIT = 50
  const undoStack = ref([])
  const redoStack = ref([])
  let isApplyingHistory = false

  function snapshotState() {
    return JSON.parse(JSON.stringify({
      columns: columns.value,
      pinnedNoteIds: pinnedNoteIds.value,
      trash: trash.value,
      tags: tags.value,
      columnWorkspaceMap: columnWorkspaceMap.value
    }))
  }
  function recordSnapshot() {
    if (isApplyingHistory || !dataLoaded.value) return
    undoStack.value.push(snapshotState())
    if (undoStack.value.length > HISTORY_LIMIT) undoStack.value.shift()
    redoStack.value = []
  }
  function applySnapshot(snap) {
    columns.value = snap.columns
    pinnedNoteIds.value = snap.pinnedNoteIds
    trash.value = snap.trash || []
    tags.value = snap.tags || []
    columnWorkspaceMap.value = snap.columnWorkspaceMap || {}
  }
  function undo() {
    if (!undoStack.value.length) return false
    isApplyingHistory = true
    redoStack.value.push(snapshotState())
    applySnapshot(undoStack.value.pop())
    setTimeout(() => { isApplyingHistory = false }, 0)
    addNotification('↶ Action annulée', 'info')
    return true
  }
  function redo() {
    if (!redoStack.value.length) return false
    isApplyingHistory = true
    undoStack.value.push(snapshotState())
    applySnapshot(redoStack.value.pop())
    setTimeout(() => { isApplyingHistory = false }, 0)
    addNotification('↷ Action rétablie', 'info')
    return true
  }
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  // ─── Notifications ───
  function addNotification(message, type = 'info') {
    const id = ++notifId
    notifications.value.push({ id, message, type })
    setTimeout(() => removeNotification(id), 5000)
    return id
  }
  function removeNotification(id) {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) notifications.value.splice(idx, 1)
  }

  // ─── Columns permanentes ───
  function ensurePermanentColumns() {
    const wsStore = useWorkspaceStore()

    // Migrate old fixed-id in-progress column
    const inProgressIdx = columns.value.findIndex(c => c.id === '__col_in_progress__')
    if (inProgressIdx !== -1) {
      const old = columns.value[inProgressIdx]
      const newId = crypto.randomUUID()
      columnWorkspaceMap.value[newId] = columnWorkspaceMap.value[old.id] || wsStore.primaryWorkspaceId
      delete columnWorkspaceMap.value[old.id]
      columns.value[inProgressIdx] = { id: newId, title: old.title || 'En cours', notes: old.notes || [] }
    }
  }

  // ─── Computed ───
  const activeNote = computed(() => {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === activeNoteId.value)
      if (note) return note
    }
    return null
  })

  const currentPage = computed(() => {
    if (!activeNote.value) return null
    if (!openPagePath.value.length) return activeNote.value
    let page = activeNote.value
    for (const blockId of openPagePath.value) {
      const block = page.blocks.find(b => b.id === blockId && b.type === 'page')
      if (!block) return null
      page = block
    }
    return page
  })

  const pinnedNotes = computed(() => {
    const pinned = []
    for (const col of columns.value) {
      for (const note of col.notes) {
        if (pinnedNoteIds.value.includes(note.id)) {
          pinned.push({ ...note, columnTitle: col.title })
        }
      }
    }
    return pinned
  })

  // ─── Column operations ───
  function addColumn(title) {
    recordSnapshot()
    const wsStore = useWorkspaceStore()
    const id = crypto.randomUUID()
    columnWorkspaceMap.value[id] = wsStore.primaryWorkspaceId
    columns.value.push({ id, title, notes: [] })
  }

  function deleteColumn(columnId) {
    if (isPermanentColumn(columnId)) return
    recordSnapshot()
    columns.value = columns.value.filter(c => c.id !== columnId)
    delete columnWorkspaceMap.value[columnId]
    if (!activeNote.value) activeNoteId.value = null
  }

  function renameColumn(columnId, newTitle) {
    if (isPermanentColumn(columnId)) return
    recordSnapshot()
    const col = columns.value.find(c => c.id === columnId)
    if (col) col.title = newTitle
  }

  // ─── Note operations ───
  function addNote(columnId, title, noteType = 'note') {
    const col = columns.value.find(c => c.id === columnId)
    if (!col) return
    recordSnapshot()
    const noteData = { id: crypto.randomUUID(), title, type: noteType, blocks: [] }
    if (noteType === 'task') noteData.checked = false
    if (noteType === 'date') { noteData.startDate = null; noteData.endDate = null; noteData.isDeadline = false }
    if (col.tagIds?.length) noteData.tagIds = [...col.tagIds]
    col.notes.push(noteData)
  }

  function deleteNote(noteId) {
    recordSnapshot()
    for (const col of columns.value) {
      const idx = col.notes.findIndex(n => n.id === noteId)
      if (idx !== -1) {
        const [note] = col.notes.splice(idx, 1)
        trash.value.push({
          ...note,
          _wsId: getColumnWsId(col.id),
          deletedAt: new Date().toISOString(),
          fromColumnId: col.id
        })
        break
      }
    }
    if (activeNoteId.value === noteId) { activeNoteId.value = null; openPagePath.value = [] }
    const pinIdx = pinnedNoteIds.value.indexOf(noteId)
    if (pinIdx !== -1) pinnedNoteIds.value.splice(pinIdx, 1)
  }

  function restoreFromTrash(noteId) {
    const idx = trash.value.findIndex(n => n.id === noteId)
    if (idx === -1) return
    const [note] = trash.value.splice(idx, 1)
    const { deletedAt, fromColumnId, _wsId, ...cleanNote } = note
    const targetCol = columns.value.find(c => c.id === fromColumnId)
      || columns.value[0]
    if (targetCol) {
      targetCol.notes.unshift(cleanNote)
      addNotification(`« ${cleanNote.title || 'Sans titre'} » restaurée`, 'info')
    }
  }

  function deleteForever(noteId) { trash.value = trash.value.filter(n => n.id !== noteId) }
  function emptyTrash() { trash.value = [] }
  function cleanupOldTrash() {
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
    trash.value = trash.value.filter(n => new Date(n.deletedAt).getTime() >= cutoff)
  }

  function renameNote(noteId, newTitle) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) { recordSnapshot(); note.title = newTitle; return }
    }
  }

  function updateNoteType(noteId, newType) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        recordSnapshot()
        note.type = newType
        if (newType === 'task' && note.checked === undefined) note.checked = false
        if (newType === 'date') {
          if (note.startDate === undefined) note.startDate = null
          if (note.endDate === undefined) note.endDate = null
          if (note.isDeadline === undefined) note.isDeadline = false
        }
        return
      }
    }
  }

  function setNoteDuration(noteId, startDate, endDate) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) { recordSnapshot(); note.startDate = startDate; note.endDate = endDate; delete note.notifiedAt; return }
    }
  }

  function setNoteTime(noteId, time) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) { recordSnapshot(); if (time) note.startTime = time; else delete note.startTime; delete note.notifiedAt; return }
    }
  }

  function setNoteIsDeadline(noteId, isDeadline) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) { recordSnapshot(); note.isDeadline = isDeadline; if (isDeadline) note.endDate = null; return }
    }
  }

  function setNoteDeadline(noteId, date) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) { note.deadline = date; return }
    }
  }

  function toggleNoteChecked(noteId) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note && note.type === 'task') { recordSnapshot(); note.checked = !note.checked; return }
    }
  }

  function setNoteColor(noteId, color) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) { recordSnapshot(); if (color) note.customColor = color; else delete note.customColor; return }
    }
  }

  function setActiveNote(noteId) {
    activeNoteId.value = activeNoteId.value === noteId ? null : noteId
    openPagePath.value = []
  }

  function migrateNotes() {
    for (const col of columns.value) {
      for (const note of col.notes) {
        if (note.type === 'deadline') { note.type = 'date'; note.isDeadline = true; note.startDate = note.deadline || null; note.endDate = null; delete note.deadline }
        else if (note.type === 'duration') { note.type = 'date'; note.isDeadline = false }
      }
    }
  }

  // ─── Blocks ───
  function addBlock(type, data = {}) {
    const page = currentPage.value
    if (!page) return
    page.blocks.push({ id: crypto.randomUUID(), type, ...getDefaultBlockData(type, data) })
  }

  function getDefaultBlockData(type, data) {
    switch (type) {
      case 'text': return { content: data.content || '' }
      case 'page': return { title: data.title || 'Sans titre', blocks: [] }
      case 'embed': return { url: toEmbedUrl(data.url || ''), originalUrl: data.url || '', label: data.label || '' }
      default: return {}
    }
  }

  function toEmbedUrl(url) {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`
    const sh = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    if (sh) return `https://docs.google.com/spreadsheets/d/${sh[1]}/pubhtml?widget=true&headers=false`
    const dc = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
    if (dc) return `https://docs.google.com/document/d/${dc[1]}/pub?embedded=true`
    const sl = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/)
    if (sl) return `https://docs.google.com/presentation/d/${sl[1]}/embed`
    return url
  }

  function updateBlock(blockId, updates) {
    const page = currentPage.value
    if (!page) return
    const block = page.blocks.find(b => b.id === blockId)
    if (block) Object.assign(block, updates)
  }

  function deleteBlock(blockId) {
    const page = currentPage.value
    if (!page) return
    page.blocks = page.blocks.filter(b => b.id !== blockId)
    if (openPagePath.value.includes(blockId)) {
      openPagePath.value = openPagePath.value.slice(0, openPagePath.value.indexOf(blockId))
    }
  }

  function openSubPage(blockId) { openPagePath.value.push(blockId) }
  function goBackTo(index) {
    openPagePath.value = index === -1 ? [] : openPagePath.value.slice(0, index + 1)
  }

  // ─── Move ───
  function moveNote(noteId, fromColumnId, toColumnId, newIndex) {
    const fromCol = columns.value.find(c => c.id === fromColumnId)
    const toCol = columns.value.find(c => c.id === toColumnId)
    if (!fromCol || !toCol) return
    const noteIndex = fromCol.notes.findIndex(n => n.id === noteId)
    if (noteIndex === -1) return

    recordSnapshot()
    const [note] = fromCol.notes.splice(noteIndex, 1)
    toCol.notes.splice(newIndex, 0, note)

    if (toCol.tagIds?.length) {
      if (!note.tagIds) note.tagIds = []
      for (const tagId of toCol.tagIds) {
        if (!note.tagIds.includes(tagId)) note.tagIds.push(tagId)
      }
    }
  }

  function archiveNote(noteId, silent = false) {
    const col = findColumnOfNote(noteId)
    if (!col) return
    const note = col.notes.find(n => n.id === noteId)
    const title = note?.title
    deleteNote(noteId)
    if (!silent) addNotification(`« ${title || 'Sans titre'} » envoyée à la corbeille`, 'info')
  }

  function checkExpiredDeadlines() {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const toTrash = []
    for (const col of columns.value) {
      for (const note of col.notes) {
        if (note.type !== 'date') continue
        const ref = note.isDeadline ? note.startDate : (note.endDate || note.startDate)
        if (!ref) continue
        const refDate = new Date(ref)
        refDate.setHours(0, 0, 0, 0)
        if (refDate.getTime() < now.getTime()) toTrash.push(note.id)
      }
    }
    for (const id of toTrash) archiveNote(id, true)
    return toTrash.length
  }

  function addDateNote({ title, startDate, endDate, isDeadline, color, startTime }) {
    const wsStore = useWorkspaceStore()
    let col = columns.value[0]
    if (!col) {
      const id = crypto.randomUUID()
      col = { id, title: 'Mes notes', notes: [] }
      columnWorkspaceMap.value[id] = wsStore.primaryWorkspaceId
      columns.value.unshift(col)
    }
    recordSnapshot()
    const note = {
      id: crypto.randomUUID(), title: title || 'Nouvelle date', type: 'date', blocks: [],
      startDate: startDate || null, endDate: isDeadline ? null : (endDate || null), isDeadline: !!isDeadline
    }
    if (color) note.customColor = color
    if (startTime) note.startTime = startTime
    col.notes.push(note)
    return note
  }

  // ─── Notifications navigateur ───
  function requestBrowserNotificationPermission() {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported')
    if (Notification.permission === 'granted') return Promise.resolve('granted')
    if (Notification.permission === 'denied') return Promise.resolve('denied')
    return Notification.requestPermission()
  }

  function fireBrowserNotification(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try { new Notification(title, { body, icon: '/favicon.ico', tag: 'my-notion' }) }
    catch (e) { console.warn('Notification error:', e) }
  }

  function checkUpcomingDeadlines() {
    const now = Date.now()
    let count = 0
    for (const col of columns.value) {
      for (const note of col.notes) {
        if (note.type !== 'date' || !note.startDate || !note.startTime || note.notifiedAt) continue
        const [hh, mm] = note.startTime.split(':').map(Number)
        const dt = new Date(note.startDate)
        dt.setHours(hh || 0, mm || 0, 0, 0)
        const target = dt.getTime()
        if (target <= now && now - target < 86400000) {
          note.notifiedAt = new Date().toISOString()
          const label = dt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          addNotification(`⏰ ${note.title} — ${label}`, 'reminder')
          fireBrowserNotification('Rappel My Notion', `${note.title} — ${label}`)
          count++
        }
      }
    }
    return count
  }

  // ─── Pins ───
  const FAVORIS_TAG_NAME = '★ Favoris'

  function togglePin(noteId) {
    recordSnapshot()
    const idx = pinnedNoteIds.value.indexOf(noteId)
    const favId = getFavorisTagId()
    if (idx === -1) {
      pinnedNoteIds.value.push(noteId)
      if (favId) {
        for (const col of columns.value) {
          const note = col.notes.find(n => n.id === noteId)
          if (note) { if (!note.tagIds) note.tagIds = []; if (!note.tagIds.includes(favId)) note.tagIds.push(favId); break }
        }
      }
    } else {
      pinnedNoteIds.value.splice(idx, 1)
      if (favId) {
        for (const col of columns.value) {
          const note = col.notes.find(n => n.id === noteId)
          if (note?.tagIds) { const ti = note.tagIds.indexOf(favId); if (ti !== -1) note.tagIds.splice(ti, 1); break }
        }
      }
    }
  }

  function isPinned(noteId) { return pinnedNoteIds.value.includes(noteId) }

  function ensureDefaultTags() {
    const wsStore = useWorkspaceStore()
    for (const wsId of wsStore.activeWorkspaceIds) {
      const wsHasFavoris = tags.value.some(t => t.name === FAVORIS_TAG_NAME && t._wsId === wsId)
      if (!wsHasFavoris) {
        const anyFavoris = tags.value.some(t => t.name === FAVORIS_TAG_NAME)
        if (!anyFavoris) {
          tags.value.push({ id: crypto.randomUUID(), name: FAVORIS_TAG_NAME, color: '#f59e0b', _wsId: wsId })
        }
      }
    }
  }

  function getFavorisTagId() {
    const tag = tags.value.find(t => t.name === FAVORIS_TAG_NAME)
    return tag ? tag.id : null
  }

  function syncPinsWithFavorisTag() {
    const favId = getFavorisTagId()
    if (!favId) return
    for (const col of columns.value) {
      for (const note of col.notes) {
        if (pinnedNoteIds.value.includes(note.id)) {
          if (!note.tagIds) note.tagIds = []
          if (!note.tagIds.includes(favId)) note.tagIds.push(favId)
        }
      }
    }
  }

  // ─── Tags ───
  function addTag(name, color) {
    const wsStore = useWorkspaceStore()
    const id = crypto.randomUUID()
    tags.value.push({ id, name, color: color || '#94a3b8', _wsId: wsStore.primaryWorkspaceId })
    return id
  }

  function deleteTag(tagId) {
    if (tagId === getFavorisTagId()) return
    tags.value = tags.value.filter(t => t.id !== tagId)
    for (const col of columns.value) {
      if (col.tagIds) col.tagIds = col.tagIds.filter(id => id !== tagId)
      for (const note of col.notes) {
        if (note.tagIds) note.tagIds = note.tagIds.filter(id => id !== tagId)
      }
    }
  }

  function updateTag(tagId, updates) {
    const tag = tags.value.find(t => t.id === tagId)
    if (tag) Object.assign(tag, updates)
  }

  function setColumnTags(columnId, tagIds) {
    const col = columns.value.find(c => c.id === columnId)
    if (col) col.tagIds = tagIds
  }

  function toggleNoteTag(noteId, tagId) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        if (!note.tagIds) note.tagIds = []
        const idx = note.tagIds.indexOf(tagId)
        if (idx === -1) {
          note.tagIds.push(tagId)
          if (tagId === getFavorisTagId() && !pinnedNoteIds.value.includes(noteId)) pinnedNoteIds.value.push(noteId)
        } else {
          note.tagIds.splice(idx, 1)
          if (tagId === getFavorisTagId()) {
            const pi = pinnedNoteIds.value.indexOf(noteId)
            if (pi !== -1) pinnedNoteIds.value.splice(pi, 1)
          }
        }
        return
      }
    }
  }

  function getNotesForTag(tagId) {
    const result = []
    for (const col of columns.value) {
      for (const note of col.notes) {
        if ((note.tagIds?.includes(tagId)) || (col.tagIds?.includes(tagId))) {
          result.push({ ...note, columnTitle: col.title })
        }
      }
    }
    return result
  }

  // ─── Firestore persistence ───

  function buildWsPayload() {
    const wsStore = useWorkspaceStore()
    if (!wsStore.activeWorkspaceIds.length) return null

    const byWs = {}
    for (const wsId of wsStore.activeWorkspaceIds) {
      byWs[wsId] = { columns: [], pins: [], trash: [], tags: [] }
    }

    for (const col of columns.value) {
      const wsId = columnWorkspaceMap.value[col.id] || wsStore.primaryWorkspaceId
      if (byWs[wsId]) byWs[wsId].columns.push(cleanCol(col))
    }

    for (const noteId of pinnedNoteIds.value) {
      for (const col of columns.value) {
        if (col.notes.some(n => n.id === noteId)) {
          const wsId = columnWorkspaceMap.value[col.id] || wsStore.primaryWorkspaceId
          if (byWs[wsId]) byWs[wsId].pins.push(noteId)
          break
        }
      }
    }

    for (const item of trash.value) {
      const wsId = item._wsId || wsStore.primaryWorkspaceId
      if (byWs[wsId]) byWs[wsId].trash.push(cleanItem(item))
    }

    for (const tag of tags.value) {
      const wsId = tag._wsId || wsStore.primaryWorkspaceId
      if (byWs[wsId]) byWs[wsId].tags.push(cleanItem(tag))
    }

    return byWs
  }

  function saveToFirestore() {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      if (isRemoteUpdate) return
      const byWs = buildWsPayload()
      if (!byWs) return

      try {
        for (const [wsId, data] of Object.entries(byWs)) {
          const payload = {
            columns: JSON.parse(JSON.stringify(data.columns)),
            pins:    JSON.parse(JSON.stringify(data.pins)),
            trash:   JSON.parse(JSON.stringify(data.trash)),
            tags:    JSON.parse(JSON.stringify(data.tags)),
          }
          const payloadJson = JSON.stringify(payload)
          if (lastSavedJson[wsId] === payloadJson) continue

          lastSavedJson[wsId] = payloadJson
          const docRef = doc(db, 'workspaces', wsId)
          const wsSnap = await getDoc(docRef)
          const existing = wsSnap.exists() ? wsSnap.data() : {}
          await setDoc(docRef, {
            ...existing,
            ...payload,
            updatedAt: new Date().toISOString()
          })
        }
      } catch (e) {
        console.error('Erreur sauvegarde Firestore:', e)
      }
    }, 500)
  }

  // Per-workspace cached snapshot data for merge
  const wsDataCache = {}

  function mergeAllWorkspaces() {
    const wsStore = useWorkspaceStore()
    const allColumns = []
    const allPins = []
    const allTrash = []
    const allTags = []
    const newCwMap = {}

    for (const wsId of wsStore.activeWorkspaceIds) {
      const cached = wsDataCache[wsId]
      if (!cached) continue
      const ws = wsStore.workspaces.find(w => w.id === wsId)
      const wsIcon = ws?.icon || '📁'
      const wsName = ws?.name || ''

      for (const col of (cached.columns || [])) {
        if (col.archive) {
          for (const note of (col.notes || [])) {
            allTrash.push({
              ...note, _wsId: wsId,
              deletedAt: note.archivedAt || new Date().toISOString(),
              fromColumnId: col.id
            })
          }
        } else {
          newCwMap[col.id] = wsId
          allColumns.push({ ...col, _wsId: wsId, _wsIcon: wsIcon, _wsName: wsName })
        }
      }
      allPins.push(...(cached.pins || []))
      for (const item of (cached.trash || [])) {
        allTrash.push({ ...item, _wsId: wsId })
      }
      for (const tag of (cached.tags || [])) {
        allTags.push({ ...tag, _wsId: wsId })
      }
    }

    isRemoteUpdate = true
    columnWorkspaceMap.value = newCwMap
    columns.value = allColumns
    pinnedNoteIds.value = [...new Set(allPins)]
    trash.value = allTrash
    tags.value = allTags
    setTimeout(() => { isRemoteUpdate = false }, 0)
  }

  function stopAllListeners() {
    for (const [wsId, unsub] of Object.entries(snapshotUnsubscribers)) {
      unsub()
      delete snapshotUnsubscribers[wsId]
    }
  }

  function startListenerForWorkspace(wsId) {
    if (snapshotUnsubscribers[wsId]) return
    const docRef = doc(db, 'workspaces', wsId)

    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return
      const data = snap.data()

      const incomingPayload = JSON.stringify({
        columns: data.columns || [],
        pins: data.pins || [],
        trash: data.trash || [],
        tags: data.tags || []
      })

      if (lastSavedJson[wsId] === incomingPayload) return

      wsDataCache[wsId] = {
        columns: data.columns || [],
        pins: data.pins || [],
        trash: data.trash || [],
        tags: data.tags || []
      }

      lastSavedJson[wsId] = incomingPayload
      mergeAllWorkspaces()

      if (dataLoaded.value) {
        migrateNotes()
        ensurePermanentColumns()
        ensureDefaultTags()
        syncPinsWithFavorisTag()
      }
    }, (error) => {
      console.warn('Erreur listener workspace:', wsId, error)
    })

    snapshotUnsubscribers[wsId] = unsub
  }

  async function loadFromFirestore() {
    const wsStore = useWorkspaceStore()
    if (!wsStore.activeWorkspaceIds.length) return

    stopAllListeners()

    // Initial load with getDoc for each workspace, then attach listeners
    for (const wsId of wsStore.activeWorkspaceIds) {
      try {
        const snap = await getDoc(doc(db, 'workspaces', wsId))
        if (snap.exists()) {
          const data = snap.data()
          wsDataCache[wsId] = {
            columns: data.columns || [],
            pins: data.pins || [],
            trash: data.trash || [],
            tags: data.tags || []
          }
          lastSavedJson[wsId] = JSON.stringify({
            columns: data.columns || [],
            pins: data.pins || [],
            trash: data.trash || [],
            tags: data.tags || []
          })
        }
      } catch (e) {
        console.warn('Erreur chargement workspace:', wsId, e)
      }
    }

    mergeAllWorkspaces()
    migrateNotes()
    ensurePermanentColumns()
    ensureDefaultTags()
    syncPinsWithFavorisTag()
    cleanupOldTrash()
    checkExpiredDeadlines()
    dataLoaded.value = true

    // Start real-time listeners after initial load
    for (const wsId of wsStore.activeWorkspaceIds) {
      startListenerForWorkspace(wsId)
    }
  }

  watch([columns, pinnedNoteIds, trash, tags], () => {
    if (dataLoaded.value && !isRemoteUpdate) saveToFirestore()
  }, { deep: true })

  return {
    columns, trash, tags, activeNoteId, activeNote, openPagePath, currentPage,
    pinnedNotes, dataLoaded, notifications, canUndo, canRedo,
    undo, redo,
    addColumn, deleteColumn, renameColumn,
    addNote, deleteNote, renameNote, updateNoteType,
    toggleNoteChecked, setNoteDeadline, setNoteDuration, setNoteIsDeadline, setNoteTime, setNoteColor,
    setActiveNote, addBlock, updateBlock, deleteBlock, openSubPage, goBackTo,
    moveNote, archiveNote, checkExpiredDeadlines, checkUpcomingDeadlines,
    requestBrowserNotificationPermission, addDateNote, isPermanentColumn,
    addNotification, removeNotification,
    togglePin, isPinned,
    restoreFromTrash, deleteForever, emptyTrash,
    addTag, deleteTag, updateTag, setColumnTags, toggleNoteTag, getNotesForTag,
    loadFromFirestore, stopAllListeners
  }
})
