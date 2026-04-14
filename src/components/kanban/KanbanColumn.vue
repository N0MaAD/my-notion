<template>
<div
    class="column"
    :style="columnStyle"
    :class="{
      'column-dragging': isColumnDragging,
      'column-drop-target': isColumnDropTarget,
      'column-archive': column.archive,
      'column-permanent': column.permanent
    }"
    @dragover.prevent="onColumnDragOver"
    @dragleave="onColumnDragLeave"
    @drop="onColumnDrop"
  >
  <div class="column-header">
    <div class="column-header-left">
    <span
    v-if="!column.permanent"
    class="column-drag-handle"
    draggable="true"
    @dragstart.stop="onColumnDragStart"
    @dragend="onColumnDragEnd"
  >⠿</span>
    <span v-else class="column-permanent-icon" :title="column.archive ? 'Colonne archive' : 'Colonne permanente'">
      {{ column.archive ? '🗄️' : '📌' }}
    </span>
      <ColorPicker
        v-if="!column.permanent"
        :color="column.color || null"
        :opacity="column.opacity ?? 1"
        @update:color="updateColor"
        @update:opacity="updateOpacity"
      />
      <h3 v-if="!isRenaming">{{ column.title }}</h3>
      <input
        v-else
        class="input"
        v-model="newTitle"
        @keyup.enter="submitRename"
        @keyup.escape="cancelRename"
        @blur="submitRename"
        ref="renameRef"
      />
    </div>
    <div v-if="!column.permanent" class="column-actions">
      <button class="btn btn-ghost" @click="startRename" title="Renommer">✎</button>
      <button class="btn btn-danger" @click="confirmDeleteColumn" title="Supprimer">✕</button>
    </div>
  </div>

  <div
    class="column-cards"
    :class="{ 'drop-target': isDragOver }"
    @dragover.prevent="onCardDragOver"
    @dragleave="onCardDragLeave"
    @drop.stop="onCardDrop"
  >
    <KanbanCard
      v-for="(note, index) in column.notes"
      :key="note.id"
      :note="note"
      :columnId="column.id"
      :index="index"
    />
  </div>

  <AddCard :columnId="column.id" />
</div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import KanbanCard from './KanbanCard.vue'
import AddCard from './AddCard.vue'
import ColorPicker from './ColorPicker.vue'
import { useBoardStore } from '../../stores/board.js'

const store = useBoardStore()
const props = defineProps({ column: Object })

const isRenaming = ref(false)
const newTitle = ref('')
const renameRef = ref(null)
const isDragOver = ref(false)
const isColumnDragging = ref(false)
const isColumnDropTarget = ref(false)

const columnStyle = computed(() => {
if (props.column.archive) {
  return {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderTop: '3px solid #ef4444'
  }
}
if (!props.column.color) return {}
const r = parseInt(props.column.color.slice(1, 3), 16)
const g = parseInt(props.column.color.slice(3, 5), 16)
const b = parseInt(props.column.color.slice(5, 7), 16)
const opacity = props.column.opacity ?? 1
return {
  backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
  borderTop: `3px solid ${props.column.color}`
}
})

function updateColor(color) {
props.column.color = color
}

function updateOpacity(opacity) {
props.column.opacity = opacity
}

// Column drag
function onColumnDragStart(e) {
isColumnDragging.value = true
e.dataTransfer.setData('columnId', props.column.id)
e.dataTransfer.effectAllowed = 'move'
}

function onColumnDragEnd() {
isColumnDragging.value = false
}

function onColumnDragOver(e) {
const columnId = e.dataTransfer.types.includes('columnid')
if (!columnId) return
isColumnDropTarget.value = true
}

function onColumnDragLeave() {
isColumnDropTarget.value = false
}

function onColumnDrop(e) {
isColumnDropTarget.value = false
const fromColumnId = e.dataTransfer.getData('columnId')
if (!fromColumnId || fromColumnId === props.column.id) return

// Réordonner les colonnes
const fromIndex = store.columns.findIndex(c => c.id === fromColumnId)
const toIndex = store.columns.findIndex(c => c.id === props.column.id)
if (fromIndex === -1 || toIndex === -1) return

const [col] = store.columns.splice(fromIndex, 1)
store.columns.splice(toIndex, 0, col)
}

// Card drag
function onCardDragOver(e) {
isDragOver.value = true
}

function onCardDragLeave() {
isDragOver.value = false
}

function onCardDrop(e) {
isDragOver.value = false
const noteId = e.dataTransfer.getData('noteId')
const fromColumnId = e.dataTransfer.getData('fromColumnId')
if (!noteId || !fromColumnId) return

const cards = e.currentTarget.querySelectorAll('.card')
let insertIndex = props.column.notes.length

for (let i = 0; i < cards.length; i++) {
  const rect = cards[i].getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  if (e.clientY < midY) {
    insertIndex = i
    break
  }
}

store.moveNote(noteId, fromColumnId, props.column.id, insertIndex)
}

async function startRename() {
newTitle.value = props.column.title
isRenaming.value = true
await nextTick()
renameRef.value?.focus()
}

function submitRename() {
if (newTitle.value.trim()) {
  store.renameColumn(props.column.id, newTitle.value.trim())
}
isRenaming.value = false
}

function cancelRename() {
isRenaming.value = false
}

function confirmDeleteColumn() {
const count = props.column.notes.length
if (count > 0) {
  const ok = window.confirm(
    `Supprimer la colonne « ${props.column.title} » et ses ${count} note${count > 1 ? 's' : ''} ?\n\nTu pourras annuler avec Ctrl+Z.`
  )
  if (!ok) return
}
store.deleteColumn(props.column.id)
}
</script>