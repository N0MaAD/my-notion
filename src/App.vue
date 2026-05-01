<template>
<!-- Join page (accessible without auth) -->
<router-view v-if="isJoinRoute" />

<!-- Loading screen -->
<div v-else-if="authStore.loading" class="login-page">
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
<MobileLayout v-else-if="isMobile" />
<DesktopLayout v-else />
</template>

<script setup>
import { watch, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import LoginView from './views/LoginView.vue'
import DesktopLayout from './layouts/DesktopLayout.vue'
import MobileLayout from './layouts/MobileLayout.vue'
import { useBoardStore } from './stores/board.js'
import { useAuthStore } from './stores/auth.js'
import { useThemeStore } from './stores/theme.js'
import { useWorkspaceStore } from './stores/workspace.js'
import { useIsMobile } from './composables/useIsMobile.js'

const route = useRoute()
const store = useBoardStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const wsStore = useWorkspaceStore()
const isMobile = useIsMobile()

const isJoinRoute = computed(() => route.path.startsWith('/join/'))

let deadlineCheckInterval = null
let reminderCheckInterval = null

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
    store.stopSync()
    wsStore.cleanup()
  }
}, { immediate: true })

function onGlobalKeyDown(e) {
  const target = e.target
  const isEditable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target && target.isContentEditable)
  if (isEditable) return

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
  document.addEventListener('keydown', onGlobalKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeyDown)
  if (deadlineCheckInterval) clearInterval(deadlineCheckInterval)
  if (reminderCheckInterval) clearInterval(reminderCheckInterval)
})
</script>
