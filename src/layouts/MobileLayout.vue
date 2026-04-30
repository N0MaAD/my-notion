<template>
<div class="mobile-layout">
  <MobileTopBar
    v-if="!isNoteRoute"
    @open-settings="showSettings = true; settingsSection = $event"
    @open-search="openSearch"
  />

  <SettingsView
    v-if="showSettings"
    :initial-section="settingsSection"
    @close="showSettings = false; settingsSection = 'appearance'"
    @logout="authStore.logout(); showSettings = false"
  />

  <main class="mobile-main">
    <router-view />
  </main>

  <BottomNav v-if="!isNoteRoute" />

  <SearchModal
    @navigate="onNavigate"
    @open-settings="showSettings = true; settingsSection = $event"
    @quick-capture="quickCaptureRef?.open()"
  />
  <QuickCapture ref="quickCaptureRef" />
  <NotificationToast />
</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MobileTopBar from '../components/mobile/MobileTopBar.vue'
import BottomNav from '../components/mobile/BottomNav.vue'
import SettingsView from '../views/SettingsView.vue'
import SearchModal from '../components/SearchModal.vue'
import QuickCapture from '../components/QuickCapture.vue'
import NotificationToast from '../components/NotificationToast.vue'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const showSettings = ref(false)
const settingsSection = ref('appearance')
const quickCaptureRef = ref(null)

const isNoteRoute = computed(() => route.name === 'note')

function onNavigate(view) {
  router.push('/' + view)
}

function openSearch() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}
</script>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}
.mobile-main {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 56px;
}
.mobile-layout:has(.mobile-note-view) .mobile-main {
  padding-bottom: 0;
}
</style>
