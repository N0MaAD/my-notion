<template>
<div class="app-layout" :class="{ 'sidebar-fullscreen': isFullscreen }">
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
</div>
</template>

<script setup>
import { ref } from 'vue'
import BoardView from './views/BoardView.vue'
import SidebarView from './views/SidebarView.vue'
import SearchModal from './components/SearchModal.vue'
import { useBoardStore } from './stores/board.js'

const store = useBoardStore()
const sidebarWidth = ref(400)
const isFullscreen = ref(false)

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