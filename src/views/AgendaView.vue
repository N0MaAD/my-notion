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

  <DateEventModal
    :visible="modalVisible"
    :editing="!!editingNote"
    :initial-data="modalInitialData"
    @close="closeModal"
    @save="onModalSave"
    @delete="deleteFromModal"
  />
</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBoardStore, NOTE_TYPES } from '../stores/board.js'
import DateEventModal from '../components/DateEventModal.vue'

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
const modalInitialData = ref(null)

function isoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function openCreateModal(date) {
  editingNote.value = null
  modalInitialData.value = { startDate: isoDate(date) }
  modalVisible.value = true
}

function openEditModal(note) {
  editingNote.value = note
  modalInitialData.value = note
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  editingNote.value = null
}

function onModalSave(data) {
  if (editingNote.value) {
    store.renameNote(editingNote.value.id, data.title)
    store.setNoteIsDeadline(editingNote.value.id, data.isDeadline)
    store.setNoteDuration(editingNote.value.id, data.startDate, data.endDate)
    store.setNoteTime(editingNote.value.id, data.startTime)
    store.setNoteColor(editingNote.value.id, data.color)
  } else {
    store.addDateNote({
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      isDeadline: data.isDeadline,
      color: data.color,
      startTime: data.startTime
    })
  }
  if (data.startTime) store.requestBrowserNotificationPermission?.()
  closeModal()
}

function deleteFromModal() {
  if (editingNote.value) {
    store.deleteNote(editingNote.value.id)
  }
  closeModal()
}
</script>
