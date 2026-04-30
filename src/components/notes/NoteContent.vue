<template>
<div class="note-content" v-if="store.currentPage">
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
      @click="isMobileMode ? startRename() : null"
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

  <div v-if="store.openPagePath.length === 0" class="sidebar-tags">
    <span
      v-for="tag in noteTags"
      :key="tag.id"
      class="sidebar-tag-chip"
      :style="{ background: tag.color + '22', color: tag.color, borderColor: tag.color + '44' }"
      @click="store.toggleNoteTag(store.activeNoteId, tag.id)"
      title="Cliquer pour retirer"
    >{{ tag.name }} ✕</span>
    <div class="sidebar-tag-add-wrap">
      <button class="sidebar-tag-add-btn" @click="showTagPicker = !showTagPicker">+ Tag</button>
      <div v-if="showTagPicker" class="sidebar-tag-picker">
        <div
          v-for="tag in availableTags"
          :key="tag.id"
          class="sidebar-tag-picker-item"
          @click="store.toggleNoteTag(store.activeNoteId, tag.id)"
        >
          <span class="sidebar-tag-dot" :style="{ background: tag.color }"></span>
          <span>{{ tag.name }}</span>
        </div>
        <div v-if="availableTags.length === 0" class="sidebar-tag-picker-empty">Tous les tags sont déjà ajoutés</div>
      </div>
    </div>
  </div>

  <PageEditor :key="store.currentPage?.id || store.activeNoteId" />
</div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useBoardStore } from '../../stores/board.js'
import PageEditor from '../blocks/PageEditor.vue'

defineProps({
  isMobileMode: { type: Boolean, default: false }
})

const store = useBoardStore()

const isRenaming = ref(false)
const newTitle = ref('')
const renameRef = ref(null)
const showTagPicker = ref(false)

const noteTags = computed(() => {
  const note = store.activeNote
  if (!note || !note.tagIds) return []
  return note.tagIds.map(id => store.tags.find(t => t.id === id)).filter(Boolean)
})

const availableTags = computed(() => {
  const note = store.activeNote
  const currentIds = note?.tagIds || []
  return store.tags.filter(t => !currentIds.includes(t.id))
})

function onClickOutsideTagPicker(e) {
  if (showTagPicker.value && !e.target.closest('.sidebar-tag-add-wrap')) {
    showTagPicker.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutsideTagPicker))
onUnmounted(() => document.removeEventListener('click', onClickOutsideTagPicker))

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
