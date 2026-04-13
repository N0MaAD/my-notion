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
    >
      <div class="agenda-cell-date">{{ cell.day }}</div>
      <div class="agenda-cell-notes">
        <div
          v-for="note in cell.notes"
          :key="note.id"
          class="agenda-note"
          :class="[`agenda-note-${note.type || 'note'}`, { 'is-checked': note.checked }]"
          :style="noteStyle(note)"
          @click="store.setActiveNote(note.id)"
          :title="note.title + ' (' + note.columnTitle + ')'"
        >
          <span v-if="noteTypeInfo(note)" class="agenda-note-icon">{{ noteTypeInfo(note).icon }}</span>
          <span class="agenda-note-title">{{ note.title }}</span>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed } from 'vue'
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

// Toutes les notes avec une deadline
const notesWithDeadlines = computed(() => {
  const result = []
  for (const col of store.columns) {
    for (const note of col.notes) {
      if (note.deadline) {
        result.push({ ...note, columnTitle: col.title })
      }
    }
  }
  return result
})

// Toutes les notes de type duration avec au moins une date
const notesWithDuration = computed(() => {
  const result = []
  for (const col of store.columns) {
    for (const note of col.notes) {
      if (note.type === 'duration' && (note.startDate || note.endDate)) {
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

// Construit la grille de 6 semaines (42 cellules) du mois affiche
const calendarCells = computed(() => {
  const cells = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)

  // Jour de la semaine du 1er (0=Dim, 1=Lun, ..., 6=Sam)
  // On veut commencer par lundi, donc decalage = (firstDay.getDay() + 6) % 7
  const startOffset = (firstDay.getDay() + 6) % 7

  // Date de debut : premier lundi de la grille
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - startOffset)

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    date.setHours(0, 0, 0, 0)

    const inMonth = date.getMonth() === currentMonth.value
    const isToday = date.getTime() === today.getTime()

    // Notes dont la deadline tombe ce jour
    const deadlineNotes = notesWithDeadlines.value.filter(n => {
      return toDay(n.deadline).getTime() === date.getTime()
    })

    // Notes de type duration qui couvrent ce jour
    const durationNotes = notesWithDuration.value.filter(n => {
      const start = n.startDate ? toDay(n.startDate).getTime() : -Infinity
      const end = n.endDate ? toDay(n.endDate).getTime() : Infinity
      const t = date.getTime()
      return t >= start && t <= end
    })

    const notes = [...durationNotes, ...deadlineNotes]

    cells.push({
      key: date.toISOString(),
      day: date.getDate(),
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
  const info = noteTypeInfo(note)
  if (!info.color) return {}
  return { borderLeft: `0.2rem solid ${info.color}` }
}
</script>
