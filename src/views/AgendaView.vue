<template>
<div class="agenda-view">
  <!-- Header: mois + navigation -->
  <div class="agenda-header">
    <button class="agenda-nav-btn" @click="prevMonth" title="Mois precedent">‹</button>
    <h2 class="agenda-month">{{ monthLabel }}</h2>
    <button class="agenda-nav-btn" @click="nextMonth" title="Mois suivant">›</button>
    <button class="agenda-today-btn" @click="goToday">Aujourd'hui</button>
  </div>

  <!-- Jours de la semaine -->
  <div class="agenda-weekdays">
    <div v-for="day in weekDays" :key="day" class="agenda-weekday">{{ day }}</div>
  </div>

  <!-- Grille du mois -->
  <div class="agenda-grid">
    <div
      v-for="cell in calendarCells"
      :key="cell.key"
      class="agenda-cell"
      :class="{
        'other-month': !cell.inMonth,
        'is-today': cell.isToday
      }"
      @click="openCreateModal(cell.date)"
    >
      <div class="agenda-cell-date">{{ cell.day }}</div>
      <div class="agenda-cell-notes">
        <div
          v-for="note in cell.notes"
          :key="note.id"
          class="agenda-note"
          :class="[`agenda-note-${note.type || 'note'}`, { 'is-checked': note.checked }]"
          :style="noteStyle(note)"
          @click.stop="openEditModal(note)"
          :title="note.title + ' (' + note.columnTitle + ')'"
        >
          <span v-if="noteTypeInfo(note)" class="agenda-note-icon">{{ noteTypeInfo(note).icon }}</span>
          <span v-if="note.startTime" class="agenda-note-time">{{ note.startTime }}</span>
          <span class="agenda-note-title">{{ note.title }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal création / édition -->
  <Teleport to="body">
    <div v-if="modalVisible" class="agenda-modal-overlay" @click="closeModal">
      <div class="agenda-modal" @click.stop>
        <div class="agenda-modal-header">
          <h3>{{ editingNote ? 'Modifier la note' : 'Nouvelle date' }}</h3>
          <button class="agenda-modal-close" @click="closeModal">×</button>
        </div>

        <div class="agenda-modal-body">
          <label class="agenda-modal-label">Titre</label>
          <input
            v-model="form.title"
            type="text"
            class="agenda-modal-input"
            placeholder="Titre de la note..."
            @keyup.enter="submitModal"
            ref="titleInputRef"
          />

          <label class="agenda-modal-checkbox">
            <input type="checkbox" v-model="form.isDeadline" />
            <span>Deadline (date unique)</span>
          </label>

          <label class="agenda-modal-label">{{ form.isDeadline ? '📅 Date' : '🗓️ Début' }}</label>
          <input v-model="form.startDate" type="date" class="agenda-modal-input" />

          <template v-if="!form.isDeadline">
            <label class="agenda-modal-label">🗓️ Fin</label>
            <input v-model="form.endDate" type="date" class="agenda-modal-input" />
          </template>

          <label class="agenda-modal-checkbox">
            <input type="checkbox" v-model="form.hasTime" />
            <span>⏰ Définir une heure (rappel)</span>
          </label>

          <input
            v-if="form.hasTime"
            v-model="form.startTime"
            type="time"
            class="agenda-modal-input"
          />

          <label class="agenda-modal-label">Couleur</label>
          <div class="agenda-modal-colors">
            <button
              v-for="c in colorPalette"
              :key="c.value || 'none'"
              class="agenda-color-swatch"
              :class="{ active: form.color === c.value }"
              :style="{ background: c.value || 'transparent', borderColor: c.value || '#999' }"
              :title="c.label"
              @click="form.color = c.value"
            >
              <span v-if="!c.value">∅</span>
            </button>
          </div>
        </div>

        <div class="agenda-modal-footer">
          <button v-if="editingNote" class="btn btn-danger" @click="deleteFromModal">Supprimer</button>
          <span class="agenda-modal-spacer"></span>
          <button class="btn btn-ghost" @click="closeModal">Annuler</button>
          <button class="btn btn-accent" @click="submitModal">{{ editingNote ? 'Enregistrer' : 'Créer' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useBoardStore, NOTE_TYPES } from '../stores/board.js'

const store = useBoardStore()

const today = new Date()
today.setHours(0, 0, 0, 0)

const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())

const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const monthNames = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
]

const monthLabel = computed(() => `${monthNames[currentMonth.value]} ${currentYear.value}`)

const colorPalette = [
  { value: null, label: 'Défaut' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Rouge' },
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#14b8a6', label: 'Turquoise' },
  { value: '#a855f7', label: 'Violet' },
  { value: '#22c55e', label: 'Vert' },
  { value: '#ec4899', label: 'Rose' }
]

// Toutes les notes de type 'date' avec au moins une date renseignee
const dateNotes = computed(() => {
  const result = []
  for (const col of store.columns) {
    for (const note of col.notes) {
      if (note.type === 'date' && (note.startDate || note.endDate)) {
        result.push({ ...note, columnTitle: col.title })
      }
    }
  }
  return result
})

function toDay(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

const calendarCells = computed(() => {
  const cells = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - startOffset)

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    date.setHours(0, 0, 0, 0)

    const inMonth = date.getMonth() === currentMonth.value
    const isToday = date.getTime() === today.getTime()

    const notes = dateNotes.value.filter(n => {
      if (n.isDeadline) {
        if (!n.startDate) return false
        return toDay(n.startDate).getTime() === date.getTime()
      }
      const start = n.startDate ? toDay(n.startDate).getTime() : -Infinity
      const end = n.endDate ? toDay(n.endDate).getTime() : Infinity
      const t = date.getTime()
      return t >= start && t <= end
    })

    cells.push({
      key: date.toISOString(),
      day: date.getDate(),
      date,
      inMonth,
      isToday,
      notes
    })
  }

  return cells
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function goToday() {
  currentMonth.value = today.getMonth()
  currentYear.value = today.getFullYear()
}

function noteTypeInfo(note) {
  return NOTE_TYPES[note.type || 'note'] || NOTE_TYPES.note
}

function noteStyle(note) {
  const color = note.customColor || noteTypeInfo(note).color
  if (!color) return {}
  return { borderLeft: `0.2rem solid ${color}` }
}

// ─── Modal ───
const modalVisible = ref(false)
const editingNote = ref(null)
const titleInputRef = ref(null)
const form = ref({
  title: '',
  isDeadline: true,
  startDate: '',
  endDate: '',
  hasTime: false,
  startTime: '09:00',
  color: null
})

function isoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function openCreateModal(date) {
  editingNote.value = null
  form.value = {
    title: '',
    isDeadline: true,
    startDate: isoDate(date),
    endDate: '',
    hasTime: false,
    startTime: '09:00',
    color: null
  }
  modalVisible.value = true
  await nextTick()
  titleInputRef.value?.focus()
}

async function openEditModal(note) {
  editingNote.value = note
  form.value = {
    title: note.title || '',
    isDeadline: !!note.isDeadline,
    startDate: note.startDate ? note.startDate.slice(0, 10) : '',
    endDate: note.endDate ? note.endDate.slice(0, 10) : '',
    hasTime: !!note.startTime,
    startTime: note.startTime || '09:00',
    color: note.customColor || null
  }
  modalVisible.value = true
  await nextTick()
  titleInputRef.value?.focus()
}

function closeModal() {
  modalVisible.value = false
  editingNote.value = null
}

function submitModal() {
  const title = form.value.title.trim()
  if (!title) return

  const time = form.value.hasTime ? form.value.startTime : null

  if (editingNote.value) {
    store.renameNote(editingNote.value.id, title)
    store.setNoteIsDeadline(editingNote.value.id, form.value.isDeadline)
    store.setNoteDuration(
      editingNote.value.id,
      form.value.startDate || null,
      form.value.isDeadline ? null : (form.value.endDate || null)
    )
    store.setNoteTime(editingNote.value.id, time)
    store.setNoteColor(editingNote.value.id, form.value.color)
  } else {
    store.addDateNoteToInProgress({
      title,
      startDate: form.value.startDate || null,
      endDate: form.value.endDate || null,
      isDeadline: form.value.isDeadline,
      color: form.value.color,
      startTime: time
    })
  }

  if (time) store.requestBrowserNotificationPermission()

  closeModal()
}

function deleteFromModal() {
  if (editingNote.value) {
    store.deleteNote(editingNote.value.id)
  }
  closeModal()
}
</script>
