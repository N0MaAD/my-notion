<template>
<div class="app-layout" :class="{ 'sidebar-fullscreen': isFullscreen }">
  <!-- User bar -->
  <div class="user-bar">
    <div class="user-bar-left">
      <button type="button" class="user-info" aria-label="Ouvrir les paramètres du compte" title="Paramètres du compte" @click="showSettings = true">
        <img v-if="authStore.user.photoURL" :src="authStore.user.photoURL" alt="" class="user-avatar" referrerpolicy="no-referrer" />
        <span class="user-name">{{ authStore.user.displayName }}</span>
      </button>
      <WorkspaceSwitcher @manage="showSettings = true; settingsSection = 'workspaces'" />
    </div>

    <nav class="nav-tabs" aria-label="Navigation principale">
      <router-link class="nav-tab" active-class="active" to="/notes" aria-label="Notes" title="Notes">
        <PhCheckSquare :size="18" />
      </router-link>
      <router-link class="nav-tab" active-class="active" to="/agenda" aria-label="Agenda" title="Agenda">
        <PhCalendarDot :size="18" />
      </router-link>
      <router-link class="nav-tab" active-class="active" to="/tags" aria-label="Tags" title="Tags">
        <PhStar :size="18" />
      </router-link>
      <router-link class="nav-tab" active-class="active" to="/trash" aria-label="Corbeille" title="Corbeille">
        <PhTrash :size="18" />
      </router-link>
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
    <router-view />
  </div>
  <button
    v-if="store.activeNote && !isFullscreen"
    type="button"
    class="sidebar-resizer"
    role="separator"
    aria-label="Redimensionner le panneau de note"
    title="Redimensionner le panneau"
    aria-orientation="vertical"
    aria-valuemin="300"
    aria-valuemax="1200"
    :aria-valuenow="sidebarWidth"
    aria-keyshortcuts="ArrowLeft ArrowRight"
    @mousedown="startResize"
    @keydown.left.prevent="resizeSidebar(20)"
    @keydown.right.prevent="resizeSidebar(-20)"
  />
  <aside v-if="store.activeNote" class="sidebar" :class="{ fullscreen: isFullscreen }" :style="!isFullscreen ? { width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' } : {}">
    <SidebarView :is-fullscreen="isFullscreen" @toggle-fullscreen="isFullscreen = !isFullscreen" />
  </aside>
  <SearchModal
    @navigate="onNavigate"
    @open-settings="showSettings = true; settingsSection = $event"
    @quick-capture="quickCaptureRef?.open()"
  />
  <QuickCapture ref="quickCaptureRef" />
  <NotificationToast />

  <!-- Trash drop zone -->
  <Transition name="trash">
    <div
      v-if="isDraggingCard && $route.name === 'notes'"
      class="trash-zone"
      :class="{ 'trash-hover': isOverTrash }"
      @dragover.prevent="isOverTrash = true"
      @dragleave="isOverTrash = false"
      @drop.prevent="onTrashDrop"
    >
      <span class="trash-icon"><PhTrash :size="24" /></span>
    </div>
  </Transition>
</div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SidebarView from '../views/SidebarView.vue'
import SettingsView from '../views/SettingsView.vue'
import SearchModal from '../components/SearchModal.vue'
import QuickCapture from '../components/QuickCapture.vue'
import NotificationToast from '../components/NotificationToast.vue'
import WorkspaceSwitcher from '../components/WorkspaceSwitcher.vue'
import { PhCheckSquare, PhCalendarDot, PhStar, PhTrash } from '@phosphor-icons/vue'
import { useBoardStore } from '../stores/board.js'
import { useAuthStore } from '../stores/auth.js'

const store = useBoardStore()
const authStore = useAuthStore()
const router = useRouter()

const showSettings = ref(false)
const settingsSection = ref('appearance')
const sidebarWidth = ref(400)
const isFullscreen = ref(false)
const isDraggingCard = ref(false)
const isOverTrash = ref(false)
const quickCaptureRef = ref(null)

// Sync route /notes/:id → store.activeNoteId on desktop
const route = useRoute()
watch(() => route.params.id, (id) => {
  if (route.name === 'note' && id) {
    store.activeNoteId = id
    store.openPagePath = []
    router.replace('/notes')
  }
}, { immediate: true })

function onNavigate(view) {
  router.push('/' + view)
}

function onTrashDrop(e) {
  const noteId = e.dataTransfer.getData('noteId')
  if (noteId) store.deleteNote(noteId)
  isDraggingCard.value = false
  isOverTrash.value = false
}

function onGlobalDragStart(e) {
  if (e.dataTransfer.types.includes('noteid')) isDraggingCard.value = true
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

function startResize(e) {
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  function onMouseMove(e) {
    sidebarWidth.value = Math.max(300, Math.min(1200, startWidth + (startX - e.clientX)))
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

function resizeSidebar(delta) {
  sidebarWidth.value = Math.max(300, Math.min(1200, sidebarWidth.value + delta))
}
</script>
