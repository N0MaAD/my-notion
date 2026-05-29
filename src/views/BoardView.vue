<template>
<div class="board-wrapper">
  <!-- Pinned notes bar -->
  <div v-if="store.pinnedNotes.length > 0" class="pinned-bar">
    <span class="pinned-bar-label"><PhStar :size="14" /> Épinglées</span>
    <div class="pinned-notes">
      <div
        v-for="note in store.pinnedNotes"
        :key="note.id"
        class="pinned-note"
        :class="{ active: store.activeNoteId === note.id }"
        @click="onPinnedClick(note.id)"
      >
        <span class="pinned-note-title">{{ note.title }}</span>
        <span class="pinned-note-col">{{ note.columnTitle }}</span>
      </div>
    </div>
  </div>

  <div class="board">
    <KanbanColumn
      v-for="column in store.columns"
      :key="column.id"
      :column="column"
    />
    <AddColumn />
  </div>
</div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { PhStar } from '@phosphor-icons/vue'
import KanbanColumn from '../components/kanban/KanbanColumn.vue'
import AddColumn from '../components/kanban/AddColumn.vue'
import { useBoardStore } from '../stores/board.js'
import { useIsMobile } from '../composables/useIsMobile.js'

const store = useBoardStore()
const router = useRouter()
const isMobile = useIsMobile()

function onPinnedClick(noteId) {
  if (isMobile.value) {
    router.push('/notes/' + noteId)
  } else {
    store.setActiveNote(noteId)
  }
}
</script>