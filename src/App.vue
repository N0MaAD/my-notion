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
import { watch, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import LoginView from './views/LoginView.vue'
import { useAuthStore } from './stores/auth.js'
import { useThemeStore } from './stores/theme.js'
import { useIsMobile } from './composables/useIsMobile.js'

const DesktopLayout = defineAsyncComponent(() => import('./layouts/DesktopLayout.vue'))
const MobileLayout = defineAsyncComponent(() => import('./layouts/MobileLayout.vue'))

const route = useRoute()
const authStore = useAuthStore()
useThemeStore()
const isMobile = useIsMobile()

let store = null
let wsStore = null
let initializationId = 0

const isJoinRoute = computed(() => route.path.startsWith('/join/'))

let deadlineCheckInterval = null
let reminderCheckInterval = null

watch(() => authStore.user, async (user) => {
  const currentInitializationId = ++initializationId

  if (user) {
    const [{ useBoardStore }, { useWorkspaceStore }] = await Promise.all([
      import('./stores/board.js'),
      import('./stores/workspace.js')
    ])
    if (currentInitializationId !== initializationId || authStore.user?.uid !== user.uid) return

    store = useBoardStore()
    wsStore = useWorkspaceStore()
    await wsStore.loadWorkspaces()
    if (currentInitializationId !== initializationId) return
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
    import('./push.js').then(({ registerPush, listenForegroundMessages }) => {
      registerPush(user.uid).catch(() => {})
      listenForegroundMessages((payload) => {
        const n = payload.notification
        if (n?.title) store.addNotification(n.title + (n.body ? ' — ' + n.body : ''), 'info')
      })
    }).catch(() => {})
  } else {
    store?.stopSync()
    wsStore?.cleanup()
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
    store?.undo()
  } else if (meta && ((e.key === 'z' || e.key === 'Z') && e.shiftKey || e.key === 'y' || e.key === 'Y')) {
    e.preventDefault()
    store?.redo()
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
