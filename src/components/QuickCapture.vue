<template>
<Teleport to="body">
  <div v-if="isOpen" class="qc-overlay" @click.self="close">
    <div class="qc-modal">
      <div class="qc-header">
        <span class="qc-label">⚡ Capture rapide</span>
        <select v-model="selectedColId" class="qc-col-select">
          <option v-for="col in targetCols" :key="col.id" :value="col.id">{{ col.title }}</option>
        </select>
      </div>
      <input
        ref="titleRef"
        v-model="title"
        class="qc-note-title"
        placeholder="Titre de la note…"
        @keydown.enter.prevent="onTitleEnter"
        @keydown.escape="close"
      />
      <textarea
        ref="contentRef"
        v-model="content"
        class="qc-note-content"
        placeholder="Contenu (optionnel)…"
        rows="4"
        @keydown.escape="close"
        @keydown.ctrl.enter.prevent="capture(true)"
        @keydown.meta.enter.prevent="capture(true)"
      />
      <div class="qc-footer">
        <span class="qc-hint">↵ créer · Ctrl+↵ créer et ouvrir · Échap fermer</span>
        <div class="qc-btns">
          <button class="btn btn-ghost btn-sm" @click="close">Annuler</button>
          <button class="btn btn-accent btn-sm" @click="capture(false)" :disabled="!title.trim()">Créer</button>
        </div>
      </div>
    </div>
  </div>
</Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useBoardStore } from '../stores/board.js'

const store = useBoardStore()

const isOpen = ref(false)
const title = ref('')
const content = ref('')
const selectedColId = ref(null)
const titleRef = ref(null)
const contentRef = ref(null)

const targetCols = computed(() => store.columns)

function open() {
  isOpen.value = true
  title.value = ''
  content.value = ''
  if (!selectedColId.value || !targetCols.value.find(c => c.id === selectedColId.value)) {
    selectedColId.value = targetCols.value[0]?.id || null
  }
  nextTick(() => titleRef.value?.focus())
}

function close() { isOpen.value = false }

function onTitleEnter() {
  if (content.value.trim()) contentRef.value?.focus()
  else capture(false)
}

function capture(andOpen) {
  if (!title.value.trim() || !selectedColId.value) return
  store.addNote(selectedColId.value, title.value.trim())
  const col = store.columns.find(c => c.id === selectedColId.value)
  if (col) {
    const note = col.notes[col.notes.length - 1]
    if (note && content.value.trim()) {
      note.blocks = [{ id: crypto.randomUUID(), type: 'text', content: content.value.trim().replace(/\n/g, '<br>') }]
    }
    if (note && andOpen) store.setActiveNote(note.id)
  }
  store.addNotification(`« ${title.value.trim()} » créée`, 'info')
  close()
}

function onKeydown(e) {
  if (e.altKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault()
    isOpen.value ? close() : open()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

defineExpose({ open, close })
</script>
