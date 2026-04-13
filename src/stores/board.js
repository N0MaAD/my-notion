import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuthStore } from './auth.js'

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

  let saveTimeout = null

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
    columns.value = columns.value.filter(c => c.id !== columnId)
    if (activeNote.value === null) activeNoteId.value = null
  }

  function renameColumn(columnId, newTitle) {
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
    toCol.notes.splice(newIndex, 0, note)
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
    setActiveNote,
    addBlock,
    updateBlock,
    deleteBlock,
    openSubPage,
    goBackTo,
    moveNote,
    togglePin,
    isPinned,
    loadFromFirestore
  }
})
