<template>
<div class="ws-switcher" ref="switcherRef">
  <button class="ws-current" @click="open = !open">
    <span class="ws-current-icon">{{ activeWorkspace?.icon || '📁' }}</span>
    <span class="ws-current-name">{{ activeWorkspace?.name || 'Workspace' }}</span>
    <span class="ws-current-arrow">{{ open ? '▴' : '▾' }}</span>
  </button>

  <div v-if="open" class="ws-dropdown">
    <div class="ws-dropdown-header">Espaces de travail</div>
    <div class="ws-list">
      <button
        v-for="ws in workspaces"
        :key="ws.id"
        class="ws-item"
        :class="{ active: ws.id === activeWorkspaceId }"
        @click="switchTo(ws.id)"
      >
        <span class="ws-item-icon">{{ ws.icon }}</span>
        <div class="ws-item-info">
          <span class="ws-item-name">{{ ws.name }}</span>
          <span class="ws-item-meta">
            {{ ws.memberCount > 1 ? ws.memberCount + ' membres' : 'Personnel' }}
          </span>
        </div>
        <span v-if="ws.id === activeWorkspaceId" class="ws-item-check">✓</span>
      </button>
    </div>

    <div class="ws-dropdown-footer">
      <button class="ws-action" @click="showCreate = true">
        <span class="ws-action-icon">+</span>
        <span>Nouvel espace</span>
      </button>
      <button class="ws-action" @click="$emit('manage')">
        <span class="ws-action-icon">⚙</span>
        <span>Gérer les espaces</span>
      </button>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showCreate" class="ws-modal-overlay" @click="showCreate = false">
      <div class="ws-modal" @click.stop>
        <div class="ws-modal-header">
          <h3>Nouvel espace de travail</h3>
          <button class="ws-modal-close" @click="showCreate = false">✕</button>
        </div>
        <div class="ws-modal-body">
          <label class="ws-modal-label">Nom</label>
          <input
            v-model="newName"
            class="ws-modal-input"
            placeholder="Ex: Famille, Projet X..."
            @keydown.enter="createNew"
          />
          <label class="ws-modal-label">Icône</label>
          <div class="ws-icon-grid">
            <button
              v-for="icon in ICONS"
              :key="icon"
              class="ws-icon-btn"
              :class="{ active: newIcon === icon }"
              @click="newIcon = icon"
            >{{ icon }}</button>
          </div>
          <label class="ws-modal-label">Type</label>
          <div class="ws-type-row">
            <button
              class="ws-type-btn"
              :class="{ active: newType === 'personal' }"
              @click="newType = 'personal'"
            >
              <span>🏠</span>
              <span>Personnel</span>
            </button>
            <button
              class="ws-type-btn"
              :class="{ active: newType === 'work' }"
              @click="newType = 'work'"
            >
              <span>💼</span>
              <span>Travail</span>
            </button>
            <button
              class="ws-type-btn"
              :class="{ active: newType === 'shared' }"
              @click="newType = 'shared'"
            >
              <span>👥</span>
              <span>Partagé</span>
            </button>
          </div>
        </div>
        <div class="ws-modal-footer">
          <button class="btn btn-ghost" @click="showCreate = false">Annuler</button>
          <button class="btn btn-accent" @click="createNew" :disabled="!newName.trim()">Créer</button>
        </div>
      </div>
    </div>
  </Teleport>
</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useBoardStore } from '../stores/board.js'

const emit = defineEmits(['manage'])
const wsStore = useWorkspaceStore()
const boardStore = useBoardStore()

const open = ref(false)
const showCreate = ref(false)
const newName = ref('')
const newIcon = ref('📁')
const newType = ref('shared')
const switcherRef = ref(null)

const ICONS = ['🏠', '💼', '👥', '📁', '🎓', '🎨', '🔬', '🏗️', '🎮', '🎵', '📚', '🌍', '❤️', '⭐', '🚀', '💡']

const workspaces = computed(() => wsStore.workspaces)
const activeWorkspaceId = computed(() => wsStore.activeWorkspaceId)
const activeWorkspace = computed(() => wsStore.activeWorkspace)

async function switchTo(wsId) {
  if (wsId === wsStore.activeWorkspaceId) {
    open.value = false
    return
  }
  boardStore.dataLoaded = false
  boardStore.activeNoteId = null
  boardStore.openPagePath = []
  await wsStore.switchWorkspace(wsId)
  await boardStore.loadFromFirestore()
  open.value = false
}

async function createNew() {
  if (!newName.value.trim()) return
  const wsId = await wsStore.createWorkspace(newName.value.trim(), newIcon.value, newType.value)
  if (wsId) {
    showCreate.value = false
    newName.value = ''
    newIcon.value = '📁'
    newType.value = 'shared'
    await switchTo(wsId)
  }
}

function onClickOutside(e) {
  if (switcherRef.value && !switcherRef.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
