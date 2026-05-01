<template>
<div class="mobile-topbar">
  <div class="mobile-topbar-left">
    <button class="btn btn-ghost mobile-hamburger" @click="$emit('open-drawer')">
      <span class="hamburger-icon">☰</span>
    </button>
    <WorkspaceSwitcher @manage="$emit('open-settings', 'workspaces')" />
  </div>
  <div class="mobile-topbar-right">
    <button class="btn btn-ghost mobile-search-btn" @click="$emit('open-search')">🔍</button>
    <button class="btn btn-ghost mobile-avatar-btn" @click="$emit('open-settings', 'appearance')">
      <img
        v-if="authStore.user?.photoURL"
        :src="authStore.user.photoURL"
        class="mobile-avatar"
        referrerpolicy="no-referrer"
      />
      <span v-else class="mobile-avatar-fallback">{{ (authStore.user?.displayName || '?')[0] }}</span>
    </button>
  </div>
</div>
</template>

<script setup>
import { useAuthStore } from '../../stores/auth.js'
import WorkspaceSwitcher from '../WorkspaceSwitcher.vue'

const authStore = useAuthStore()

defineEmits(['open-settings', 'open-search', 'open-drawer'])
</script>

<style scoped>
.mobile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1dvh 3vw;
  width: 100vw;
  background: var(--bg-secondary, #1a1a2e);
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  flex-shrink: 0;
}
.mobile-topbar-left {
  display: flex;
  align-items: center;
  gap: 1vw;
}
.mobile-topbar-right {
  display: flex;
  align-items: center;
  gap: 1vw;
}
.mobile-hamburger {
  min-width: 10vw;
  min-height: 6dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.hamburger-icon {
  font-size: 5.5vw;
}
.mobile-search-btn,
.mobile-avatar-btn {
  min-width: 10vw;
  min-height: 6dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mobile-avatar {
  width: 8vw;
  height: 8vw;
  border-radius: 50%;
  object-fit: cover;
}
.mobile-avatar-fallback {
  width: 8vw;
  height: 8vw;
  border-radius: 50%;
  background: var(--accent, #38bdf8);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 3.5vw;
}
</style>
