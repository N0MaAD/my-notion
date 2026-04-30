<template>
<nav class="bottom-nav">
  <router-link to="/notes" class="bottom-nav-item" active-class="active" :class="{ active: $route.name === 'note' }">
    <span class="bottom-nav-icon">📋</span>
    <span class="bottom-nav-label">Notes</span>
  </router-link>
  <router-link to="/agenda" class="bottom-nav-item" active-class="active">
    <span class="bottom-nav-icon">📅</span>
    <span class="bottom-nav-label">Agenda</span>
  </router-link>
  <router-link to="/tags" class="bottom-nav-item" active-class="active">
    <span class="bottom-nav-icon">🏷️</span>
    <span class="bottom-nav-label">Tags</span>
  </router-link>
</nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-secondary, #1a1a2e);
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.bottom-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 0;
  min-height: 56px;
  color: var(--text-secondary, #8892b0);
  text-decoration: none;
  transition: color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.bottom-nav-item.active {
  color: var(--accent, #38bdf8);
}
.bottom-nav-icon {
  font-size: 1.3rem;
  line-height: 1;
}
.bottom-nav-label {
  font-size: 0.7rem;
  font-weight: 500;
}
</style>
