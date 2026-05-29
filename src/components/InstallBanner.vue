<template>
<div v-if="showBanner" class="install-banner">
  <div class="install-banner-content">
    <div class="install-banner-text">
      <strong>My Notion</strong>
      <span>Installe l'app et active les notifications pour ne rien manquer</span>
    </div>
    <div class="install-banner-actions">
      <button v-if="canInstall" class="install-btn" @click="installApp">Installer</button>
      <button v-if="canNotify" class="install-btn install-btn-secondary" @click="enableNotifs">Notifications</button>
      <button class="install-btn-dismiss" @click="dismiss">Plus tard</button>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const showBanner = ref(false)
const canInstall = ref(false)
const canNotify = ref(false)
let deferredPrompt = null

function shouldShow() {
  const dismissed = localStorage.getItem('pwa-banner-dismissed')
  if (dismissed) {
    const dismissedAt = parseInt(dismissed, 10)
    if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return false
  }
  return true
}

function onBeforeInstall(e) {
  e.preventDefault()
  deferredPrompt = e
  canInstall.value = true
  if (shouldShow()) showBanner.value = true
}

async function installApp() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const result = await deferredPrompt.userChoice
  if (result.outcome === 'accepted') {
    canInstall.value = false
    deferredPrompt = null
    if (!canNotify.value) showBanner.value = false
  }
}

async function enableNotifs() {
  if (!('Notification' in window)) return
  const perm = await Notification.requestPermission()
  if (perm === 'granted') {
    canNotify.value = false
    if (!canInstall.value) showBanner.value = false
  }
}

function dismiss() {
  showBanner.value = false
  localStorage.setItem('pwa-banner-dismissed', String(Date.now()))
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstall)

  if (window.matchMedia('(display-mode: standalone)').matches) {
    canInstall.value = false
  }

  if ('Notification' in window && Notification.permission === 'default') {
    canNotify.value = true
  }

  setTimeout(() => {
    if ((canInstall.value || canNotify.value) && shouldShow()) {
      showBanner.value = true
    }
  }, 2000)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall)
})
</script>

<style scoped>
.install-banner {
  position: fixed;
  bottom: 8vh;
  left: 2vw;
  right: 2vw;
  z-index: 9999;
  animation: slideUp 0.3s ease;
}
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.install-banner-content {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.install-banner-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  color: var(--text-primary, #e2e8f0);
}
.install-banner-text strong {
  font-size: 16px;
}
.install-banner-text span {
  font-size: 13px;
  color: var(--text-secondary, #8892b0);
}
.install-banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.install-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #38bdf8);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  min-height: 44px;
}
.install-btn-secondary {
  background: rgba(56, 189, 248, 0.15);
  color: var(--accent, #38bdf8);
}
.install-btn-dismiss {
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #8892b0);
  font-size: 13px;
  cursor: pointer;
  min-height: 44px;
}
</style>
