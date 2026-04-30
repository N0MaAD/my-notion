<template>
<div class="sidebar-inner" v-if="store.currentPage">
  <!-- Navigation panel gauche en mode fullscreen -->
  <div v-if="isFullscreen" class="sidebar-nav" :class="{ collapsed: navCollapsed }">
    <div class="sidebar-nav-header">
      <span v-if="!navCollapsed" class="sidebar-nav-title">Notes</span>
      <button class="btn btn-ghost" @click="navCollapsed = !navCollapsed">
        {{ navCollapsed ? '›' : '‹' }}
      </button>
    </div>
    <div v-if="!navCollapsed" class="sidebar-nav-tree">
      <template v-for="col in store.columns" :key="col.id">
        <div class="nav-column-title">{{ col.title }}</div>
        <template v-for="note in col.notes" :key="note.id">
          <div
            class="nav-note-item"
            :class="{ active: store.activeNoteId === note.id }"
            @click="selectNote(note.id)"
          >
            <span class="nav-note-title">📄 {{ note.title }}</span>
            <button
              v-if="hasSubPages(note)"
              class="btn btn-ghost nav-expand-btn"
              @click.stop="toggleExpand(note.id)"
            >
              {{ expanded[note.id] ? '▾' : '›' }}
            </button>
          </div>
          <template v-if="expanded[note.id]">
            <div
              v-for="block in getSubPages(note)"
              :key="block.id"
              class="nav-subpage-item"
              @click="openSubPageFromNav(note.id, block.id)"
            >
              └ 📄 {{ block.title }}
            </div>
          </template>
        </template>
      </template>
    </div>
  </div>

  <!-- Contenu principal -->
  <div class="sidebar-main">
    <div class="sidebar-top-bar">
      <button class="btn btn-ghost sidebar-close" @click="closeSidebar">✕</button>
      <div class="sidebar-top-actions">
        <button class="btn btn-ghost" @click="$emit('toggle-fullscreen')" :title="isFullscreen ? 'Réduire' : 'Plein écran'">
          {{ isFullscreen ? '⊡' : '⊞' }}
        </button>
      </div>
    </div>

    <NoteContent />
  </div>
</div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useBoardStore } from '../stores/board.js'
import NoteContent from '../components/notes/NoteContent.vue'

const props = defineProps({
  isFullscreen: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle-fullscreen'])

const store = useBoardStore()
const navCollapsed = ref(false)
const expanded = reactive({})

function closeSidebar() {
  if (props.isFullscreen) {
    emit('toggle-fullscreen')
  }
  store.setActiveNote(null)
}

function selectNote(noteId) {
  store.activeNoteId = noteId
  store.openPagePath = []
}

function hasSubPages(note) {
  return note.blocks && note.blocks.some(b => b.type === 'page')
}

function getSubPages(note) {
  if (!note.blocks) return []
  return note.blocks.filter(b => b.type === 'page')
}

function toggleExpand(noteId) {
  expanded[noteId] = !expanded[noteId]
}

function openSubPageFromNav(noteId, blockId) {
  store.activeNoteId = noteId
  store.openPagePath = [blockId]
}
</script>
