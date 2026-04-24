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
    <div class="user-bar-left">
      <div class="user-info" @click="showSettings = true">
        <img v-if="authStore.user.photoURL" :src="authStore.user.photoURL" class="user-avatar" referrerpolicy="no-referrer" />
        <span class="user-name">{{ authStore.user.displayName }}</span>
      </div>
      <WorkspaceSwitcher @manage="showSettings = true; settingsSection = 'workspaces'" />
    </div>

    <nav class="nav-tabs">
      <button
        class="nav-tab"
        :class="{ active: currentView === 'notes' }"
        @click="currentView = 'notes'"
      >Notes</button>
      <button
        class="nav-tab"
        :class="{ active: currentView === 'agenda' }"
        @click="currentView = 'agenda'"
      >Agenda</button>
      <button
        class="nav-tab"
        :class="{ active: currentView === 'tags' }"
        @click="currentView = 'tags'"
      >Tags</button>
    </nav>
  </div>

  <!-- Settings plein écran -->
  <SettingsView
    v-if="showSettings"
    :initial-section="settingsSection"
    @close="showSettings = false; settingsSection = 'appearance'"
    @logout="authStore.logout(); showSettings = false"
  />

  <div v-if="!isFullscreen" class="board-area">
    <BoardView v-if="currentView === 'notes'" />
    <AgendaView v-else-if="currentView === 'agenda'" />
    <TagsView v-else-if="currentView === 'tags'" />
  </div>
  <div
    v-if="store.activeNote && !isFullscreen"
    class="sidebar-resizer"
    @mousedown="startResize"
  />
  <aside v-if="store.activeNote" class="sidebar" :class="{ fullscreen: isFullscreen }" :style="!isFullscreen ? { width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' } : {}">
    <SidebarView :is-fullscreen="isFullscreen" @toggle-fullscreen="isFullscreen = !isFullscreen" />
  </aside>
  <SearchModal
    @navigate="currentView = $event"
    @open-settings="showSettings = true; settingsSection = $event"
    @quick-capture="quickCaptureRef?.open()"
  />
  <QuickCapture ref="quickCaptureRef" />
  <NotificationToast />

  <!-- Trash drop zone -->
  <Transition name="trash">
    <div
      v-if="isDraggingCard && currentView === 'notes'"
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
import AgendaView from './views/AgendaView.vue'
import TagsView from './views/TagsView.vue'
import SidebarView from './views/SidebarView.vue'
import SettingsView from './views/SettingsView.vue'
import SearchModal from './components/SearchModal.vue'
import QuickCapture from './components/QuickCapture.vue'
import NotificationToast from './components/NotificationToast.vue'
import LoginView from './views/LoginView.vue'
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue'
import { useBoardStore } from './stores/board.js'
import { useAuthStore } from './stores/auth.js'
import { useThemeStore } from './stores/theme.js'
import { useWorkspaceStore } from './stores/workspace.js'

const store = useBoardStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const wsStore = useWorkspaceStore()
const showSettings = ref(false)
const settingsSection = ref('appearance')
const sidebarWidth = ref(400)
const isFullscreen = ref(false)
const isDraggingCard = ref(false)
const isOverTrash = ref(false)
const currentView = ref('notes')
const quickCaptureRef = ref(null)

let deadlineCheckInterval = null
let reminderCheckInterval = null

// Charge les workspaces puis les donnees Firestore quand l'utilisateur se connecte
watch(() => authStore.user, async (user) => {
  if (user) {
    await wsStore.loadWorkspaces()
    await wsStore.checkPendingInvites()
    await store.loadFromFirestore()
    if (deadlineCheckInterval) clearInterval(deadlineCheckInterval)
    deadlineCheckInterval = setInterval(() => {
      store.checkExpiredDeadlines()
    }, 60 * 60 * 1000)
    store.checkUpcomingDeadlines()
    if (reminderCheckInterval) clearInterval(reminderCheckInterval)
    reminderCheckInterval = setInterval(() => {
      store.checkUpcomingDeadlines()
    }, 60 * 1000)
  } else {
    store.stopAllListeners()
    wsStore.cleanup()
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

function onGlobalKeyDown(e) {
  // Ne pas intercepter quand l'utilisateur tape dans un champ ou un éditeur
  const target = e.target
  const isEditable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target && target.isContentEditable)
  if (isEditable) return

  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    showSettings.value = true
    settingsSection.value = 'shortcuts'
    return
  }

  const meta = e.ctrlKey || e.metaKey
  if (meta && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (meta && ((e.key === 'z' || e.key === 'Z') && e.shiftKey || e.key === 'y' || e.key === 'Y')) {
    e.preventDefault()
    store.redo()
  }
}

onMounted(() => {
  document.addEventListener('dragstart', onGlobalDragStart)
  document.addEventListener('dragend', onGlobalDragEnd)
  document.addEventListener('keydown', onGlobalKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('dragstart', onGlobalDragStart)
  document.removeEventListener('dragend', onGlobalDragEnd)
  document.removeEventListener('keydown', onGlobalKeyDown)
  if (deadlineCheckInterval) clearInterval(deadlineCheckInterval)
  if (reminderCheckInterval) clearInterval(reminderCheckInterval)
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
