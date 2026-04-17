<template>
<div class="tags-view">
  <div class="tags-header">
    <h2 class="tags-title">Tags</h2>
    <button class="btn btn-accent tags-add-btn" @click="openCreateTag">
      + Nouveau tag
    </button>
  </div>

  <div v-if="store.tags.length === 0" class="tags-empty">
    <span class="tags-empty-icon">🏷️</span>
    <p>Aucun tag pour l'instant</p>
    <p class="tags-empty-hint">Crée ton premier tag pour organiser tes notes</p>
  </div>

  <div v-else class="tags-grid">
    <div
      v-for="tag in store.tags"
      :key="tag.id"
      class="tag-card"
      :style="tagCardStyle(tag)"
      @click="openTagDetail(tag)"
    >
      <div class="tag-card-header">
        <span class="tag-card-name">{{ tag.name }}</span>
        <span class="tag-card-count">{{ getNotesForTag(tag.id).length }}</span>
      </div>
      <div class="tag-card-preview">
        <div
          v-for="note in getNotesForTag(tag.id).slice(0, 4)"
          :key="note.id"
          class="tag-card-mini-note"
        >
          <span class="tag-mini-dot" :style="{ background: tag.color }"></span>
          <span class="tag-mini-title">{{ note.title }}</span>
        </div>
        <div v-if="getNotesForTag(tag.id).length === 0" class="tag-card-no-notes">
          Aucune note
        </div>
      </div>
    </div>
  </div>

  <!-- Modal création / modification -->
  <Teleport to="body">
    <div v-if="showModal" class="tag-modal-overlay" @click="closeModal">
      <div class="tag-modal" @click.stop>
        <div class="tag-modal-header">
          <h3>{{ editingTag ? 'Modifier le tag' : 'Nouveau tag' }}</h3>
          <button class="tag-modal-close" @click="closeModal">✕</button>
        </div>
        <div class="tag-modal-body">
          <label class="tag-modal-label">Nom</label>
          <input
            ref="nameInputRef"
            v-model="form.name"
            type="text"
            class="tag-modal-input"
            placeholder="ex: Perso, Pro, Urgent..."
            @keyup.enter="submitModal"
          />
          <label class="tag-modal-label">Couleur</label>
          <div class="tag-modal-colors">
            <button
              v-for="c in colorPalette"
              :key="c"
              class="tag-color-swatch"
              :class="{ active: form.color === c }"
              :style="{ background: c }"
              @click="form.color = c"
            />
          </div>
        </div>
        <div class="tag-modal-footer">
          <button v-if="editingTag && !isFavorisTag(editingTag)" class="btn btn-danger" @click="handleDelete">Supprimer</button>
          <span class="tag-modal-spacer"></span>
          <button class="btn btn-ghost" @click="closeModal">Annuler</button>
          <button class="btn btn-accent" @click="submitModal">{{ editingTag ? 'Enregistrer' : 'Créer' }}</button>
        </div>
      </div>
    </div>

    <!-- Detail d'un tag : liste des notes -->
    <div v-if="showDetail" class="tag-modal-overlay" @click="closeDetail">
      <div class="tag-detail" @click.stop>
        <div class="tag-detail-header">
          <div class="tag-detail-title-row">
            <span class="tag-detail-dot" :style="{ background: detailTag.color }"></span>
            <h3>{{ detailTag.name }}</h3>
            <button class="btn btn-ghost" @click="openEditTag(detailTag)" title="Modifier">✎</button>
          </div>
          <button class="tag-modal-close" @click="closeDetail">✕</button>
        </div>
        <div class="tag-detail-notes">
          <div v-if="detailNotes.length === 0" class="tags-empty" style="padding: 2rem">
            <p>Aucune note avec ce tag</p>
          </div>
          <div
            v-for="note in detailNotes"
            :key="note.id"
            class="tag-detail-note"
            @click="store.setActiveNote(note.id); closeDetail()"
          >
            <span class="tag-detail-note-icon">{{ getNoteIcon(note) }}</span>
            <div class="tag-detail-note-info">
              <span class="tag-detail-note-title">{{ note.title }}</span>
              <span class="tag-detail-note-col">{{ note.columnTitle }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useBoardStore, NOTE_TYPES } from '../stores/board.js'

const store = useBoardStore()

const colorPalette = [
  '#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#14b8a6',
  '#a855f7', '#ec4899', '#06b6d4', '#6366f1', '#94a3b8'
]

const showModal = ref(false)
const editingTag = ref(null)
const nameInputRef = ref(null)
const form = ref({ name: '', color: '#3b82f6' })

const showDetail = ref(false)
const detailTag = ref(null)
const detailNotes = computed(() => {
  if (!detailTag.value) return []
  return store.getNotesForTag(detailTag.value.id)
})

function getNotesForTag(tagId) {
  return store.getNotesForTag(tagId)
}

function isFavorisTag(tag) {
  return tag && tag.name === '★ Favoris'
}

function tagCardStyle(tag) {
  return {
    borderTop: `3px solid ${tag.color}`
  }
}

function getNoteIcon(note) {
  return (NOTE_TYPES[note.type || 'note'] || NOTE_TYPES.note).icon
}

async function openCreateTag() {
  editingTag.value = null
  form.value = { name: '', color: '#3b82f6' }
  showModal.value = true
  await nextTick()
  nameInputRef.value?.focus()
}

async function openEditTag(tag) {
  showDetail.value = false
  editingTag.value = tag
  form.value = { name: tag.name, color: tag.color }
  showModal.value = true
  await nextTick()
  nameInputRef.value?.focus()
}

function closeModal() {
  showModal.value = false
  editingTag.value = null
}

function submitModal() {
  const name = form.value.name.trim()
  if (!name) return
  if (editingTag.value) {
    store.updateTag(editingTag.value.id, { name, color: form.value.color })
  } else {
    store.addTag(name, form.value.color)
  }
  closeModal()
}

function handleDelete() {
  if (editingTag.value && confirm(`Supprimer le tag « ${editingTag.value.name} » ?`)) {
    store.deleteTag(editingTag.value.id)
    closeModal()
  }
}

function openTagDetail(tag) {
  detailTag.value = tag
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  detailTag.value = null
}
</script>
