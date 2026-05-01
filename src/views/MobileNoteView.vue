<template>
<div class="mobile-note-view">
  <div class="mobile-note-topbar">
    <button class="btn btn-ghost mobile-back-btn" @click="goBack">← Retour</button>
    <div class="mobile-note-topbar-actions">
      <button class="btn btn-ghost" @click="store.togglePin(store.activeNoteId)" v-if="store.activeNote">
        {{ store.isPinned(store.activeNoteId) ? '★' : '☆' }}
      </button>
    </div>
  </div>
  <div v-if="!store.dataLoaded" class="mobile-note-loading">Chargement...</div>
  <div v-else-if="!store.activeNote" class="mobile-note-loading">Note introuvable</div>
  <NoteContent v-else :is-mobile-mode="true" />
</div>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBoardStore } from '../stores/board.js'
import NoteContent from '../components/notes/NoteContent.vue'

const route = useRoute()
const router = useRouter()
const store = useBoardStore()

function syncNoteFromRoute() {
  const id = route.params.id
  if (id && store.activeNoteId !== id) {
    store.activeNoteId = id
    store.openPagePath = []
  }
}

watch(() => route.params.id, syncNoteFromRoute, { immediate: true })
watch(() => store.dataLoaded, (loaded) => {
  if (loaded) syncNoteFromRoute()
})

function goBack() {
  store.activeNoteId = null
  store.openPagePath = []
  router.push('/notes')
}

onBeforeUnmount(() => {
  store.activeNoteId = null
  store.openPagePath = []
})
</script>

<style scoped>
.mobile-note-view {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
}
.mobile-note-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1dvh 3vw;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
  width: 100vw;
}
.mobile-back-btn {
  font-size: 4vw;
  min-height: 6dvh;
}
.mobile-note-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-secondary);
}
.mobile-note-view :deep(.note-content) {
  flex: 1;
  overflow-y: auto;
  padding: 2dvh 3vw;
  width: 100vw;
}
.mobile-note-view :deep(.sidebar-header) {
  padding: 0 0 1dvh;
}
.mobile-note-view :deep(.sidebar-title) {
  font-size: 5.5vw;
}
</style>
