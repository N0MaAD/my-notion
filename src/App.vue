<template>
<!-- Loading screen -->
<div v-if="authStore.loading" class="login-page">
  <div class="login-card">
    <div class="login-header">
      <h1 class="login-title">My Notion</h1>
      <p class="login-subtitle">Chargement...</p>
    </div>
  </div>
</div>

<!-- Login page -->
<LoginView v-else-if="!authStore.user" />

<!-- App -->
<div v-else class="app-layout" :class="{ 'sidebar-fullscreen': isFullscreen }">
  <!-- User bar -->
  <div class="user-bar">
    <div class="user-info">
      <img v-if="authStore.user.photoURL" :src="authStore.user.photoURL" class="user-avatar" referrerpolicy="no-referrer" />
      <span class="user-name">{{ authStore.user.displayName }}</span>
    </div>
    <button class="btn-logout" @click="authStore.logout()">Deconnexion</button>
  </div>

  <div v-if="!isFullscreen" class="board-area">
    <BoardView />
  </div>
  <div
    v-if="store.activeNote && !isFullscreen"
    class="sidebar-resizer"
    @mousedown="startResize"
  />
  <aside v-if="store.activeNote" class="sidebar" :class="{ fullscreen: isFullscreen }" :style="!isFullscreen ? { width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' } : {}">
    <SidebarView :is-fullscreen="isFullscreen" @toggle-fullscreen="isFullscreen = !isFullscreen" />
  </aside>
  <SearchModal />

  <!-- Trash drop zone -->
  <Transition name="trash">
    <div
      v-if="isDraggingCard"
      class="trash-zone"
      :class="{ 'trash-hover': isOverTrash }"
      @dragover.prevent="onTrashDragOver"
      @dragleave="onTrashDragLeave"
      @drop.prevent="onTrashDrop"
    >
      <span class="trash-icon">🗑️</span>
    </div>
  </Transition>
</div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import BoardView from './views/BoardView.vue'
import SidebarView from './views/SidebarView.vue'
import SearchModal from './components/SearchModal.vue'
import LoginView from './views/LoginView.vue'
import { useBoardStore } from './stores/board.js'
import { useAuthStore } from './stores/auth.js'

const store = useBoardStore()
const authStore = useAuthStore()
const sidebarWidth = ref(400)
const isFullscreen = ref(false)
const isDraggingCard = ref(false)
const isOverTrash = ref(false)

// Charge les donnees Firestore quand l'utilisateur se connecte
watch(() => authStore.user, async (user) => {
  if (user) {
    await store.loadFromFirestore()
  }
}, { immediate: true })

function onGlobalDragStart(e) {
  if (e.dataTransfer.types.includes('noteid')) {
    isDraggingCard.value = true
  }
}

function onGlobalDragEnd() {
  isDraggingCard.value = false
  isOverTrash.value = false
}

onMounted(() => {
  document.addEventListener('dragstart', onGlobalDragStart)
  document.addEventListener('dragend', onGlobalDragEnd)
})

onUnmounted(() => {
  document.removeEventListener('dragstart', onGlobalDragStart)
  document.removeEventListener('dragend', onGlobalDragEnd)
})

function onTrashDragOver() {
  isOverTrash.value = true
}

function onTrashDragLeave() {
  isOverTrash.value = false
}

function onTrashDrop(e) {
  const noteId = e.dataTransfer.getData('noteId')
  if (noteId) {
    store.deleteNote(noteId)
  }
  isDraggingCard.value = false
  isOverTrash.value = false
}

function startResize(e) {
const startX = e.clientX
const startWidth = sidebarWidth.value

function onMouseMove(e) {
  const diff = startX - e.clientX
  const newWidth = Math.max(300, Math.min(1200, startWidth + diff))
  sidebarWidth.value = newWidth
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

document.body.style.cursor = 'col-resize'
document.body.style.userSelect = 'none'
document.addEventListener('mousemove', onMouseMove)
document.addEventListener('mouseup', onMouseUp)
}
</script>
