import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuthStore } from './auth.js'

// ─── Colonnes permanentes ───
export const ARCHIVE_COLUMN_ID = '__col_archive__'
export const ARCHIVE_RETENTION_DAYS = 20

// ─── Systeme de types extensible ───
// Pour ajouter un nouveau type : ajouter une entree ici, c'est tout.
export const NOTE_TYPES = {
  note: {
    id: 'note',
    label: 'Note',
    icon: '📄',
    color: null,
    description: 'Note classique'
  },
  task: {
    id: 'task',
    label: 'Tâche',
    icon: '☑️',
    color: '#3b82f6',
    description: 'Tâche avec case à cocher'
  },
  date: {
    id: 'date',
    label: 'Date',
    icon: '📅',
    color: '#f59e0b',
    description: 'Deadline ou periode (conges, projet...)'
  },
  idea: {
    id: 'idea',
    label: 'Idée',
    icon: '💡',
    color: '#a855f7',
    description: 'Idée / brainstorm'
  },
  bug: {
    id: 'bug',
    label: 'Bug',
    icon: '🐛',
    color: '#ef4444',
    description: 'Bug / problème'
  },
  link: {
    id: 'link',
    label: 'Lien',
    icon: '🔗',
    color: '#06b6d4',
    description: 'Lien / ressource'
  }
}

export const useBoardStore = defineStore('board', () => {
  const columns = ref([])
  const trash = ref([])
  const tags = ref([])
  const activeNoteId = ref(null)
  const openPagePath = ref([])
  const pinnedNoteIds = ref([])
  const dataLoaded = ref(false)
  const notifications = ref([])

  const TRASH_RETENTION_DAYS = 30

  let saveTimeout = null
  let notifId = 0

  // ─── Historique (undo/redo) ───
  const HISTORY_LIMIT = 50
  const undoStack = ref([])
  const redoStack = ref([])
  let isApplyingHistory = false

  function snapshotState() {
    return JSON.parse(JSON.stringify({
      columns: columns.value,
      pinnedNoteIds: pinnedNoteIds.value,
      trash: trash.value,
      tags: tags.value
    }))
  }

  function recordSnapshot() {
    if (isApplyingHistory || !dataLoaded.value) return
    undoStack.value.push(snapshotState())
    if (undoStack.value.length > HISTORY_LIMIT) undoStack.value.shift()
    // Toute nouvelle action invalide le redo
    redoStack.value = []
  }

  function applySnapshot(snap) {
    columns.value = snap.columns
    pinnedNoteIds.value = snap.pinnedNoteIds
    trash.value = snap.trash || []
    tags.value = snap.tags || []
  }

  function undo() {
    if (undoStack.value.length === 0) return false
    isApplyingHistory = true
    redoStack.value.push(snapshotState())
    const snap = undoStack.value.pop()
    applySnapshot(snap)
    setTimeout(() => { isApplyingHistory = false }, 0)
    addNotification('↶ Action annulée', 'info')
    return true
  }

  function redo() {
    if (redoStack.value.length === 0) return false
    isApplyingHistory = true
    undoStack.value.push(snapshotState())
    const snap = redoStack.value.pop()
    applySnapshot(snap)
    setTimeout(() => { isApplyingHistory = false }, 0)
    addNotification('↷ Action rétablie', 'info')
    return true
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

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

  function ensurePermanentColumns() {
    // Migration : convertit l'ancienne colonne "En cours" permanente en colonne normale
    const inProgressIdx = columns.value.findIndex(c => c.id === '__col_in_progress__')
    if (inProgressIdx !== -1) {
      const old = columns.value[inProgressIdx]
      columns.value[inProgressIdx] = {
        id: crypto.randomUUID(),
        title: old.title || 'En cours',
        notes: old.notes || []
      }
    }

    const hasArchive = columns.value.some(c => c.id === ARCHIVE_COLUMN_ID)
    if (!hasArchive) {
      columns.value.push({
        id: ARCHIVE_COLUMN_ID,
        title: 'Archivé',
        notes: [],
        permanent: true,
        archive: true,
        color: '#ef4444',
        opacity: 0.08
      })
    }
  }

  function isPermanentColumn(columnId) {
    return columnId === ARCHIVE_COLUMN_ID
  }

  function findColumnOfNote(noteId) {
    for (const col of columns.value) {
      if (col.notes.some(n => n.id === noteId)) return col
    }
    return null
  }

  const activeNote = computed(() => {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === activeNoteId.value)
      if (note) return note
    }
    return null
  })

  const currentPage = computed(() => {
    if (!activeNote.value) return null
    if (openPagePath.value.length === 0) return activeNote.value

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

  function addColumn(title) {
    recordSnapshot()
    columns.value.push({
      id: crypto.randomUUID(),
      title,
      notes: []
    })
  }

  function deleteColumn(columnId) {
    if (isPermanentColumn(columnId)) return
    recordSnapshot()
    columns.value = columns.value.filter(c => c.id !== columnId)
    if (activeNote.value === null) activeNoteId.value = null
  }

  function renameColumn(columnId, newTitle) {
    if (isPermanentColumn(columnId)) return
    recordSnapshot()
    const col = columns.value.find(c => c.id === columnId)
    if (col) col.title = newTitle
  }

  function addNote(columnId, title, noteType = 'note') {
    const col = columns.value.find(c => c.id === columnId)
    if (col) {
      recordSnapshot()
      const noteData = {
        id: crypto.randomUUID(),
        title,
        type: noteType,
        blocks: []
      }
      // Donnees specifiques au type
      if (noteType === 'task') {
        noteData.checked = false
      }
      if (noteType === 'date') {
        noteData.startDate = null
        noteData.endDate = null
        noteData.isDeadline = false
      }
      if (col.tagIds && col.tagIds.length > 0) {
        noteData.tagIds = [...col.tagIds]
      }
      col.notes.push(noteData)
    }
  }

  function deleteNote(noteId) {
    recordSnapshot()
    for (const col of columns.value) {
      const idx = col.notes.findIndex(n => n.id === noteId)
      if (idx !== -1) {
        const [note] = col.notes.splice(idx, 1)
        // Déplace en corbeille au lieu de supprimer définitivement
        trash.value.push({ ...note, deletedAt: new Date().toISOString(), fromColumnId: col.id })
        break
      }
    }
    if (activeNoteId.value === noteId) {
      activeNoteId.value = null
      openPagePath.value = []
    }
    const pinIdx = pinnedNoteIds.value.indexOf(noteId)
    if (pinIdx !== -1) pinnedNoteIds.value.splice(pinIdx, 1)
  }

  function restoreFromTrash(noteId) {
    const idx = trash.value.findIndex(n => n.id === noteId)
    if (idx === -1) return
    const [note] = trash.value.splice(idx, 1)
    const { deletedAt, fromColumnId, ...cleanNote } = note
    // Restaure dans la colonne d'origine si elle existe encore, sinon la première
    const targetCol = columns.value.find(c => c.id === fromColumnId && !c.archive)
      || columns.value.find(c => !c.archive)
    if (targetCol) {
      targetCol.notes.unshift(cleanNote)
      addNotification(`« ${cleanNote.title || 'Sans titre'} » restaurée`, 'info')
    }
  }

  function deleteForever(noteId) {
    trash.value = trash.value.filter(n => n.id !== noteId)
  }

  function emptyTrash() {
    trash.value = []
  }

  function cleanupOldTrash() {
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
    trash.value = trash.value.filter(n => new Date(n.deletedAt).getTime() >= cutoff)
  }

  function renameNote(noteId, newTitle) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        recordSnapshot()
        note.title = newTitle
        return
      }
    }
  }

  function updateNoteType(noteId, newType) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        recordSnapshot()
        note.type = newType
        if (newType === 'task' && note.checked === undefined) {
          note.checked = false
        }
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
      if (note) {
        recordSnapshot()
        note.startDate = startDate
        note.endDate = endDate
        // Reset notifiedAt si la date change pour qu'on puisse re-notifier
        delete note.notifiedAt
        return
      }
    }
  }

  function setNoteTime(noteId, time) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        recordSnapshot()
        if (time) note.startTime = time
        else delete note.startTime
        delete note.notifiedAt
        return
      }
    }
  }

  function setNoteIsDeadline(noteId, isDeadline) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        recordSnapshot()
        note.isDeadline = isDeadline
        if (isDeadline) {
          note.endDate = null
        }
        return
      }
    }
  }

  // Migre les anciens types deadline/duration vers le type unifie 'date'
  function migrateNotes() {
    for (const col of columns.value) {
      for (const note of col.notes) {
        if (note.type === 'deadline') {
          note.type = 'date'
          note.isDeadline = true
          note.startDate = note.deadline || null
          note.endDate = null
          delete note.deadline
        } else if (note.type === 'duration') {
          note.type = 'date'
          note.isDeadline = false
        }
      }
    }
  }

  function toggleNoteChecked(noteId) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note && note.type === 'task') {
        recordSnapshot()
        note.checked = !note.checked
        return
      }
    }
  }

  function setNoteDeadline(noteId, date) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        note.deadline = date
        return
      }
    }
  }

  function setActiveNote(noteId) {
    if (activeNoteId.value === noteId) {
      activeNoteId.value = null
    } else {
      activeNoteId.value = noteId
    }
    openPagePath.value = []
  }

  function addBlock(type, data = {}) {
    const page = currentPage.value
    if (!page) return

    const block = {
      id: crypto.randomUUID(),
      type,
      ...getDefaultBlockData(type, data)
    }
    page.blocks.push(block)
  }

  function getDefaultBlockData(type, data) {
    switch (type) {
      case 'text':
        return { content: data.content || '' }
      case 'page':
        return { title: data.title || 'Sans titre', blocks: [] }
      case 'embed':
        return { url: toEmbedUrl(data.url || ''), originalUrl: data.url || '', label: data.label || '' }
      default:
        return {}
    }
  }

  function toEmbedUrl(url) {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`

    const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    if (sheetsMatch) return `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/pubhtml?widget=true&headers=false`

    const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
    if (docsMatch) return `https://docs.google.com/document/d/${docsMatch[1]}/pub?embedded=true`

    const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/)
    if (slidesMatch) return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed`

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

  function openSubPage(blockId) {
    openPagePath.value.push(blockId)
  }

  function goBackTo(index) {
    if (index === -1) {
      openPagePath.value = []
    } else {
      openPagePath.value = openPagePath.value.slice(0, index + 1)
    }
  }

  function moveNote(noteId, fromColumnId, toColumnId, newIndex) {
    const fromCol = columns.value.find(c => c.id === fromColumnId)
    const toCol = columns.value.find(c => c.id === toColumnId)
    if (!fromCol || !toCol) return

    const noteIndex = fromCol.notes.findIndex(n => n.id === noteId)
    if (noteIndex === -1) return

    recordSnapshot()
    const [note] = fromCol.notes.splice(noteIndex, 1)

    // Gestion archive : entrée → archivedAt, sortie → suppression du flag
    if (toColumnId === ARCHIVE_COLUMN_ID) {
      note.archivedAt = new Date().toISOString()
    } else if (fromColumnId === ARCHIVE_COLUMN_ID) {
      delete note.archivedAt
    }

    toCol.notes.splice(newIndex, 0, note)

    if (toCol.tagIds && toCol.tagIds.length > 0) {
      if (!note.tagIds) note.tagIds = []
      for (const tagId of toCol.tagIds) {
        if (!note.tagIds.includes(tagId)) note.tagIds.push(tagId)
      }
    }
  }

  function archiveNote(noteId, silent = false) {
    const fromCol = findColumnOfNote(noteId)
    if (!fromCol || fromCol.id === ARCHIVE_COLUMN_ID) return
    const archiveCol = columns.value.find(c => c.id === ARCHIVE_COLUMN_ID)
    if (!archiveCol) return
    const idx = fromCol.notes.findIndex(n => n.id === noteId)
    if (idx === -1) return
    recordSnapshot()
    const [note] = fromCol.notes.splice(idx, 1)
    note.archivedAt = new Date().toISOString()
    archiveCol.notes.push(note)
    if (!silent) {
      addNotification(`« ${note.title} » a été archivée`, 'archive')
    }
    return note
  }

  function setNoteColor(noteId, color) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        recordSnapshot()
        if (color) note.customColor = color
        else delete note.customColor
        return
      }
    }
  }

  // Parcourt les notes 'date' et archive celles dont la deadline / fin de période est passée
  function checkExpiredDeadlines() {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const toArchive = []

    for (const col of columns.value) {
      if (col.id === ARCHIVE_COLUMN_ID) continue
      for (const note of col.notes) {
        if (note.type !== 'date') continue
        const ref = note.isDeadline ? note.startDate : (note.endDate || note.startDate)
        if (!ref) continue
        const refDate = new Date(ref)
        refDate.setHours(0, 0, 0, 0)
        if (refDate.getTime() < now.getTime()) {
          toArchive.push(note.id)
        }
      }
    }

    for (const id of toArchive) {
      archiveNote(id)
    }
    return toArchive.length
  }

  // Supprime les notes archivées depuis plus de ARCHIVE_RETENTION_DAYS jours
  function cleanupOldArchive() {
    const archiveCol = columns.value.find(c => c.id === ARCHIVE_COLUMN_ID)
    if (!archiveCol) return 0
    const cutoff = Date.now() - ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const before = archiveCol.notes.length
    archiveCol.notes = archiveCol.notes.filter(n => {
      if (!n.archivedAt) {
        n.archivedAt = new Date().toISOString()
        return true
      }
      return new Date(n.archivedAt).getTime() >= cutoff
    })
    return before - archiveCol.notes.length
  }

  // Création rapide d'une note 'date' (utilisé par l'agenda)
  // Cible la première colonne non-archive ; en crée une si nécessaire.
  function addDateNote({ title, startDate, endDate, isDeadline, color, startTime }) {
    let col = columns.value.find(c => c.id !== ARCHIVE_COLUMN_ID)
    if (!col) {
      col = {
        id: crypto.randomUUID(),
        title: 'Mes notes',
        notes: []
      }
      columns.value.unshift(col)
    }
    recordSnapshot()
    const note = {
      id: crypto.randomUUID(),
      title: title || 'Nouvelle date',
      type: 'date',
      blocks: [],
      startDate: startDate || null,
      endDate: isDeadline ? null : (endDate || null),
      isDeadline: !!isDeadline
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
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    try {
      new Notification(title, { body, icon: '/favicon.ico', tag: 'my-notion' })
    } catch (e) {
      console.warn('Notification error:', e)
    }
  }

  // Vérifie les notes 'date' avec une heure définie et fait pop une notif si l'heure est dépassée
  function checkUpcomingDeadlines() {
    const now = Date.now()
    let count = 0
    for (const col of columns.value) {
      if (col.id === ARCHIVE_COLUMN_ID) continue
      for (const note of col.notes) {
        if (note.type !== 'date') continue
        if (!note.startDate || !note.startTime) continue
        if (note.notifiedAt) continue

        // Combine date + heure → timestamp
        const [hh, mm] = note.startTime.split(':').map(Number)
        const dt = new Date(note.startDate)
        dt.setHours(hh || 0, mm || 0, 0, 0)
        const target = dt.getTime()

        // On notifie si l'heure est passée mais pas vieille de plus de 24h
        if (target <= now && now - target < 24 * 60 * 60 * 1000) {
          note.notifiedAt = new Date().toISOString()
          const dateLabel = dt.toLocaleString('fr-FR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
          })
          addNotification(`⏰ ${note.title} — ${dateLabel}`, 'reminder')
          fireBrowserNotification('Rappel My Notion', `${note.title} — ${dateLabel}`)
          count++
        }
      }
    }
    return count
  }

  function togglePin(noteId) {
    recordSnapshot()
    const idx = pinnedNoteIds.value.indexOf(noteId)
    if (idx === -1) {
      pinnedNoteIds.value.push(noteId)
      const favId = getFavorisTagId()
      if (favId) {
        for (const col of columns.value) {
          const note = col.notes.find(n => n.id === noteId)
          if (note) {
            if (!note.tagIds) note.tagIds = []
            if (!note.tagIds.includes(favId)) note.tagIds.push(favId)
            break
          }
        }
      }
    } else {
      pinnedNoteIds.value.splice(idx, 1)
      const favId = getFavorisTagId()
      if (favId) {
        for (const col of columns.value) {
          const note = col.notes.find(n => n.id === noteId)
          if (note && note.tagIds) {
            const tagIdx = note.tagIds.indexOf(favId)
            if (tagIdx !== -1) note.tagIds.splice(tagIdx, 1)
            break
          }
        }
      }
    }
  }

  function isPinned(noteId) {
    return pinnedNoteIds.value.includes(noteId)
  }

  const FAVORIS_TAG_NAME = '★ Favoris'

  function ensureDefaultTags() {
    const hasFavoris = tags.value.some(t => t.name === FAVORIS_TAG_NAME)
    if (!hasFavoris) {
      tags.value.push({ id: crypto.randomUUID(), name: FAVORIS_TAG_NAME, color: '#f59e0b' })
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
    const id = crypto.randomUUID()
    tags.value.push({ id, name, color: color || '#94a3b8' })
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
          if (tagId === getFavorisTagId() && !pinnedNoteIds.value.includes(noteId)) {
            pinnedNoteIds.value.push(noteId)
          }
        } else {
          note.tagIds.splice(idx, 1)
          if (tagId === getFavorisTagId()) {
            const pinIdx = pinnedNoteIds.value.indexOf(noteId)
            if (pinIdx !== -1) pinnedNoteIds.value.splice(pinIdx, 1)
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
        const hasDirectTag = note.tagIds && note.tagIds.includes(tagId)
        const hasColumnTag = col.tagIds && col.tagIds.includes(tagId)
        if (hasDirectTag || hasColumnTag) {
          result.push({ ...note, columnTitle: col.title })
        }
      }
    }
    return result
  }

  // ─── Firestore persistence ───

  function getUserDocRef() {
    const authStore = useAuthStore()
    if (!authStore.user) return null
    return doc(db, 'users', authStore.user.uid)
  }

  function saveToFirestore() {
    // Debounce : attend 500ms apres le dernier changement avant de sauvegarder
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      const docRef = getUserDocRef()
      if (!docRef) return
      try {
        await setDoc(docRef, {
          columns: JSON.parse(JSON.stringify(columns.value)),
          pins: JSON.parse(JSON.stringify(pinnedNoteIds.value)),
          trash: JSON.parse(JSON.stringify(trash.value)),
          tags: JSON.parse(JSON.stringify(tags.value))
        })
      } catch (e) {
        console.error('Erreur sauvegarde Firestore:', e)
      }
    }, 500)
  }

  async function loadFromFirestore() {
    const docRef = getUserDocRef()
    if (!docRef) return
    try {
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const data = snap.data()
        columns.value = data.columns || []
        pinnedNoteIds.value = data.pins || []
        trash.value = data.trash || []
        tags.value = data.tags || []
        migrateNotes()
      }
    } catch (e) {
      console.error('Erreur chargement Firestore:', e)
    }
    ensurePermanentColumns()
    ensureDefaultTags()
    syncPinsWithFavorisTag()
    cleanupOldArchive()
    cleanupOldTrash()
    checkExpiredDeadlines()
    dataLoaded.value = true
  }

  // Auto-save quand les donnees changent
  watch([columns, pinnedNoteIds, trash, tags], () => {
    if (dataLoaded.value) {
      saveToFirestore()
    }
  }, { deep: true })

  return {
    columns,
    trash,
    tags,
    activeNoteId,
    activeNote,
    openPagePath,
    currentPage,
    pinnedNotes,
    dataLoaded,
    notifications,
    canUndo,
    canRedo,
    undo,
    redo,
    addColumn,
    deleteColumn,
    renameColumn,
    addNote,
    deleteNote,
    renameNote,
    updateNoteType,
    toggleNoteChecked,
    setNoteDeadline,
    setNoteDuration,
    setNoteIsDeadline,
    setNoteTime,
    setNoteColor,
    setActiveNote,
    addBlock,
    updateBlock,
    deleteBlock,
    openSubPage,
    goBackTo,
    moveNote,
    archiveNote,
    checkExpiredDeadlines,
    checkUpcomingDeadlines,
    cleanupOldArchive,
    requestBrowserNotificationPermission,
    addDateNote,
    isPermanentColumn,
    addNotification,
    removeNotification,
    togglePin,
    isPinned,
    restoreFromTrash,
    deleteForever,
    emptyTrash,
    addTag,
    deleteTag,
    updateTag,
    setColumnTags,
    toggleNoteTag,
    getNotesForTag,
    loadFromFirestore
  }
})
