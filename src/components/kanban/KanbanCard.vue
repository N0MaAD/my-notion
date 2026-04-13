<template>
<div
  class="card"
  :class="[
    `card-type-${note.type || 'note'}`,
    { active: store.activeNoteId === note.id, dragging: isDragging, checked: note.checked }
  ]"
  :style="cardBorderStyle"
  draggable="true"
  @dragstart="onDragStart"
  @dragend="onDragEnd"
  @click="store.setActiveNote(note.id)"
  @contextmenu.prevent="openContextMenu"
>
  <div class="card-header">
    <!-- Checkbox pour les tâches -->
    <button
      v-if="note.type === 'task'"
      class="card-checkbox"
      :class="{ done: note.checked }"
      @click.stop="store.toggleNoteChecked(note.id)"
    >
      {{ note.checked ? '✓' : '' }}
    </button>

    <!-- Icône du type -->
    <span v-if="noteTypeInfo" class="card-type-icon" :title="noteTypeInfo.label">
      {{ noteTypeInfo.icon }}
    </span>

    <p :class="{ 'text-strikethrough': note.checked }">{{ note.title }}</p>

    <button
      class="btn-pin"
      :class="{ pinned: store.isPinned(note.id) }"
      @click.stop="store.togglePin(note.id)"
      :title="store.isPinned(note.id) ? 'Désépingler' : 'Épingler'"
    >
      {{ store.isPinned(note.id) ? '★' : '☆' }}
    </button>
  </div>

  <!-- Date affichee si type date -->
  <template v-if="note.type === 'date'">
    <!-- Mode deadline : une seule date -->
    <div
      v-if="note.isDeadline && note.startDate"
      class="card-deadline"
      :class="deadlineClass"
    >
      📅 {{ formatDate(note.startDate) }}
    </div>
    <!-- Mode periode : plage de dates -->
    <div
      v-else-if="!note.isDeadline && (note.startDate || note.endDate)"
      class="card-duration"
    >
      🗓️ {{ formatDurationRange(note.startDate, note.endDate) }}
    </div>
  </template>
</div>

<!-- Menu contextuel -->
<CardContextMenu
  :visible="showContextMenu"
  :x="contextX"
  :y="contextY"
  :noteId="note.id"
  :currentType="note.type || 'note'"
  :currentStartDate="note.startDate || null"
  :currentEndDate="note.endDate || null"
  :currentIsDeadline="note.isDeadline || false"
  @close="showContextMenu = false"
/>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBoardStore, NOTE_TYPES } from '../../stores/board.js'
import CardContextMenu from './CardContextMenu.vue'

const store = useBoardStore()
const props = defineProps({
  note: Object,
  columnId: String,
  index: Number
})

const isDragging = ref(false)
const showContextMenu = ref(false)
const contextX = ref(0)
const contextY = ref(0)

const noteTypeInfo = computed(() => {
  return NOTE_TYPES[props.note.type || 'note'] || NOTE_TYPES.note
})

const cardBorderStyle = computed(() => {
  const typeInfo = noteTypeInfo.value
  if (!typeInfo.color) return {}
  return { borderLeft: `3px solid ${typeInfo.color}` }
})

const deadlineClass = computed(() => {
  const target = props.note.startDate
  if (!target) return ''
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dl = new Date(target)
  const diff = (dl - now) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'deadline-overdue'
  if (diff <= 2) return 'deadline-soon'
  return 'deadline-ok'
})

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDurationRange(start, end) {
  const fmt = (s) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  if (start) return `depuis ${fmt(start)}`
  if (end) return `jusqu'au ${fmt(end)}`
  return ''
}

function onDragStart(e) {
  isDragging.value = true
  e.dataTransfer.setData('noteId', props.note.id)
  e.dataTransfer.setData('fromColumnId', props.columnId)
  e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  isDragging.value = false
}

function openContextMenu(e) {
  contextX.value = e.clientX
  contextY.value = e.clientY
  showContextMenu.value = true
}
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.card-type-icon {
  font-size: 0.8rem;
  flex-shrink: 0;
}

.card-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  flex-shrink: 0;
  transition: all 0.15s;
  padding: 0;
  color: #fff;
}

.card-checkbox:hover {
  border-color: #3b82f6;
}

.card-checkbox.done {
  background: #3b82f6;
  border-color: #3b82f6;
}

.text-strikethrough {
  text-decoration: line-through;
  opacity: 0.5;
}

.card-deadline {
  font-size: 0.72rem;
  margin-top: 0.3rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
}

.deadline-ok {
  color: #16a34a;
  background: #f0fdf4;
}

.deadline-soon {
  color: #d97706;
  background: #fffbeb;
}

.deadline-overdue {
  color: #dc2626;
  background: #fef2f2;
}

.card-duration {
  font-size: 0.72rem;
  margin-top: 0.3rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
  color: #0d9488;
  background: #f0fdfa;
}
</style>
