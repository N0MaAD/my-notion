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

    <div class="sidebar-breadcrumb">
      <button class="btn btn-ghost" @click="store.goBackTo(-1)">
        {{ store.activeNote.title }}
      </button>
      <template v-for="(blockId, i) in store.openPagePath" :key="blockId">
        <span class="breadcrumb-sep">›</span>
        <button class="btn btn-ghost" @click="store.goBackTo(i)">
          {{ getPageTitle(i) }}
        </button>
      </template>
    </div>

    <div class="sidebar-header">
      <h2
        v-if="!isRenaming"
        @dblclick="startRename"
        class="sidebar-title"
      >
        {{ store.currentPage.title }}
      </h2>
      <input
        v-else
        class="input sidebar-title-input"
        v-model="newTitle"
        @keyup.enter="submitRename"
        @keyup.escape="cancelRename"
        @blur="submitRename"
        ref="renameRef"
      />
      <div class="sidebar-actions">
        <button class="btn btn-ghost" @click="startRename" title="Renommer">✎</button>
        <button class="btn btn-danger" @click="handleDelete" title="Supprimer">🗑</button>
      </div>
    </div>

    <PageEditor :key="store.currentPage?.id || store.activeNoteId" />
  </div>
</div>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import { useBoardStore } from '../stores/board.js'
import PageEditor from '../components/blocks/PageEditor.vue'

const props = defineProps({
isFullscreen: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle-fullscreen'])

const store = useBoardStore()

const isRenaming = ref(false)
const newTitle = ref('')
const renameRef = ref(null)
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

async function startRename() {
newTitle.value = store.currentPage.title
isRenaming.value = true
await nextTick()
renameRef.value?.focus()
}

function submitRename() {
if (!newTitle.value.trim()) return cancelRename()

if (store.openPagePath.length === 0) {
  store.renameNote(store.activeNoteId, newTitle.value.trim())
} else {
  const blockId = store.openPagePath[store.openPagePath.length - 1]
  store.updateBlock(blockId, { title: newTitle.value.trim() })
}
isRenaming.value = false
}

function cancelRename() {
isRenaming.value = false
}

function handleDelete() {
if (store.openPagePath.length === 0) {
  if (confirm('Supprimer cette note ?')) {
    store.deleteNote(store.activeNoteId)
  }
} else {
  if (confirm('Supprimer cette sous-page ?')) {
    const blockId = store.openPagePath[store.openPagePath.length - 1]
    store.goBackTo(store.openPagePath.length - 2)
    store.deleteBlock(blockId)
  }
}
}

function getPageTitle(pathIndex) {
let page = store.activeNote
for (let i = 0; i <= pathIndex; i++) {
  const block = page.blocks.find(b => b.id === store.openPagePath[i])
  if (!block) return '?'
  page = block
}
return page.title
}
</script>