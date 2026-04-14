<template>
<Teleport to="body">
  <div class="toast-stack">
    <TransitionGroup name="toast">
      <div
        v-for="n in store.notifications"
        :key="n.id"
        class="toast"
        :class="`toast-${n.type}`"
        @click="store.removeNotification(n.id)"
      >
        <span class="toast-icon">
          {{ n.type === 'archive' ? '🗄️' : 'ℹ️' }}
        </span>
        <span class="toast-message">{{ n.message }}</span>
        <button class="toast-close" @click.stop="store.removeNotification(n.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</Teleport>
</template>

<script setup>
import { useBoardStore } from '../stores/board.js'
const store = useBoardStore()
</script>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 2000;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #1f2937;
  color: #fff;
  padding: 0.7rem 0.9rem;
  border-radius: 0.6rem;
  box-shadow: 0 0.6rem 1.5rem rgba(0, 0, 0, 0.25);
  font-size: 0.85rem;
  min-width: 16rem;
  max-width: 22rem;
  cursor: pointer;
  border-left: 0.25rem solid #3b82f6;
}

.toast-archive {
  border-left-color: #ef4444;
}

.toast-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.3;
}

.toast-close {
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0 0.2rem;
}

.toast-close:hover {
  color: #fff;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(2rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(2rem);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
</style>
