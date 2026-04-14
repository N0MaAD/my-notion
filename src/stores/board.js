import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuthStore } from './auth.js'

// ─── Colonnes permanentes ───
export const IN_PROGRESS_COLUMN_ID = '__col_in_progress__'
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
  const activeNoteId = ref(null)
  const openPagePath = ref([])
  const pinnedNoteIds = ref([])
  const dataLoaded = ref(false)
  const notifications = ref([])

  let saveTimeout = null
  let notifId = 0

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
    const hasInProgress = columns.value.some(c => c.id === IN_PROGRESS_COLUMN_ID)
    const hasArchive = columns.value.some(c => c.id === ARCHIVE_COLUMN_ID)

    if (!hasInProgress) {
      columns.value.unshift({
        id: IN_PROGRESS_COLUMN_ID,
        title: 'En cours',
        notes: [],
        permanent: true
      })
    }
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
    return columnId === IN_PROGRESS_COLUMN_ID || columnId === ARCHIVE_COLUMN_ID
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
    columns.value.push({
      id: crypto.randomUUID(),
      title,
      notes: []
    })
  }

  function deleteColumn(columnId) {
    if (isPermanentColumn(columnId)) return
    columns.value = columns.value.filter(c => c.id !== columnId)
    if (activeNote.value === null) activeNoteId.value = null
  }

  function renameColumn(columnId, newTitle) {
    if (isPermanentColumn(columnId)) return
    const col = columns.value.find(c => c.id === columnId)
    if (col) col.title = newTitle
  }

  function addNote(columnId, title, noteType = 'note') {
    const col = columns.value.find(c => c.id === columnId)
    if (col) {
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
      col.notes.push(noteData)
    }
  }

  function deleteNote(noteId) {
    for (const col of columns.value) {
      col.notes = col.notes.filter(n => n.id !== noteId)
    }
    if (activeNoteId.value === noteId) {
      activeNoteId.value = null
      openPagePath.value = []
    }
    const pinIdx = pinnedNoteIds.value.indexOf(noteId)
    if (pinIdx !== -1) {
      pinnedNoteIds.value.splice(pinIdx, 1)
    }
  }

  function renameNote(noteId, newTitle) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
        note.title = newTitle
        return
      }
    }
  }

  function updateNoteType(noteId, newType) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
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
        note.startDate = startDate
        note.endDate = endDate
        return
      }
    }
  }

  function setNoteIsDeadline(noteId, isDeadline) {
    for (const col of columns.value) {
      const note = col.notes.find(n => n.id === noteId)
      if (note) {
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

    const [note] = fromCol.notes.splice(noteIndex, 1)

    // Gestion archive : entrée → archivedAt, sortie → suppression du flag
    if (toColumnId === ARCHIVE_COLUMN_ID) {
      note.archivedAt = new Date().toISOString()
    } else if (fromColumnId === ARCHIVE_COLUMN_ID) {
      delete note.archivedAt
    }

    toCol.notes.splice(newIndex, 0, note)
  }

  function archiveNote(noteId, silent = false) {
    const fromCol = findColumnOfNote(noteId)
    if (!fromCol || fromCol.id === ARCHIVE_COLUMN_ID) return
    const archiveCol = columns.value.find(c => c.id === ARCHIVE_COLUMN_ID)
    if (!archiveCol) return
    const idx = fromCol.notes.findIndex(n => n.id === noteId)
    if (idx === -1) return
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

  // Création rapide d'une note 'date' dans la colonne En cours (utilisé par l'agenda)
  function addDateNoteToInProgress({ title, startDate, endDate, isDeadline, color }) {
    const col = columns.value.find(c => c.id === IN_PROGRESS_COLUMN_ID)
    if (!col) return null
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
    col.notes.push(note)
    return note
  }

  function togglePin(noteId) {
    const idx = pinnedNoteIds.value.indexOf(noteId)
    if (idx === -1) {
      pinnedNoteIds.value.push(noteId)
    } else {
      pinnedNoteIds.value.splice(idx, 1)
    }
  }

  function isPinned(noteId) {
    return pinnedNoteIds.value.includes(noteId)
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
          pins: JSON.parse(JSON.stringify(pinnedNoteIds.value))
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
        migrateNotes()
      }
    } catch (e) {
      console.error('Erreur chargement Firestore:', e)
    }
    ensurePermanentColumns()
    cleanupOldArchive()
    checkExpiredDeadlines()
    dataLoaded.value = true
  }

  // Auto-save quand les donnees changent
  watch([columns, pinnedNoteIds], () => {
    if (dataLoaded.value) {
      saveToFirestore()
    }
  }, { deep: true })

  return {
    columns,
    activeNoteId,
    activeNote,
    openPagePath,
    currentPage,
    pinnedNotes,
    dataLoaded,
    notifications,
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
    cleanupOldArchive,
    addDateNoteToInProgress,
    isPermanentColumn,
    addNotification,
    removeNotification,
    togglePin,
    isPinned,
    loadFromFirestore
  }
})
