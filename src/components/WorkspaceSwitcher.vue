<template>
<div class="ws-switcher" ref="switcherRef">
  <button class="ws-current" @click="open = !open">
    <span class="ws-current-icons">
      <span v-for="ws in activeWorkspaces" :key="ws.id" class="ws-current-icon">{{ ws.icon }}</span>
    </span>
    <span class="ws-current-name">{{ label }}</span>
    <span class="ws-current-arrow">{{ open ? '▴' : '▾' }}</span>
  </button>

  <div v-if="open" class="ws-dropdown">
    <div class="ws-dropdown-header">Espaces de travail</div>
    <div class="ws-list">
      <label
        v-for="ws in workspaces"
        :key="ws.id"
        class="ws-item ws-item-check"
        :class="{ active: isActive(ws.id) }"
        @click.prevent="toggle(ws.id)"
      >
        <span class="ws-checkbox" :class="{ checked: isActive(ws.id) }">
          <span v-if="isActive(ws.id)">✓</span>
        </span>
        <span class="ws-item-icon">{{ ws.icon }}</span>
        <div class="ws-item-info">
          <span class="ws-item-name">{{ ws.name }}</span>
          <span class="ws-item-meta">{{ ws.memberCount > 1 ? ws.memberCount + ' membres' : roleLabel(ws.role) }}</span>
        </div>
      </label>
    </div>

    <div class="ws-dropdown-footer">
      <button class="ws-action" @click="showCreate = true; open = false">
        <span class="ws-action-icon">+</span>
        <span>Nouvel espace</span>
      </button>
      <button class="ws-action" @click="$emit('manage'); open = false">
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
          <input v-model="newName" class="ws-modal-input" placeholder="Ex: Famille, Projet X..."
            @keydown.enter="createNew" autofocus />
          <label class="ws-modal-label">Icône</label>
          <div class="ws-icon-grid">
            <button v-for="icon in ICONS" :key="icon" class="ws-icon-btn"
              :class="{ active: newIcon === icon }" @click="newIcon = icon">{{ icon }}</button>
          </div>
          <label class="ws-modal-label">Type</label>
          <div class="ws-type-row">
            <button class="ws-type-btn" :class="{ active: newType === 'personal' }" @click="newType = 'personal'">
              <span>🏠</span><span>Personnel</span>
            </button>
            <button class="ws-type-btn" :class="{ active: newType === 'work' }" @click="newType = 'work'">
              <span>💼</span><span>Travail</span>
            </button>
            <button class="ws-type-btn" :class="{ active: newType === 'shared' }" @click="newType = 'shared'">
              <span>👥</span><span>Partagé</span>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useBoardStore } from '../stores/board.js'

const emit = defineEmits(['manage'])
const wsStore = useWorkspaceStore()
const boardStore = useBoardStore()

const open      = ref(false)
const showCreate = ref(false)
const newName   = ref('')
const newIcon   = ref('📁')
const newType   = ref('shared')
const switcherRef = ref(null)

const ICONS = ['🏠', '💼', '👥', '📁', '🎓', '🎨', '🔬', '🏗️', '🎮', '🎵', '📚', '🌍', '❤️', '⭐', '🚀', '💡']

const workspaces       = computed(() => wsStore.workspaces)
const activeWorkspaces = computed(() => wsStore.workspaces.filter(w => wsStore.activeWorkspaceIds.includes(w.id)))

const label = computed(() => {
  if (activeWorkspaces.value.length === 0) return 'Aucun espace'
  if (activeWorkspaces.value.length === 1) return activeWorkspaces.value[0].name
  return `${activeWorkspaces.value.length} espaces`
})

function isActive(wsId) { return wsStore.activeWorkspaceIds.includes(wsId) }
function roleLabel(role) { return role === 'owner' ? 'Propriétaire' : role === 'editor' ? 'Éditeur' : 'Lecteur' }

async function toggle(wsId) {
  const wasActive = isActive(wsId)
  // Prevent unchecking last one
  if (wasActive && wsStore.activeWorkspaceIds.length <= 1) return

  boardStore.dataLoaded = false
  boardStore.activeNoteId = null
  boardStore.openPagePath = []
  await wsStore.toggleWorkspace(wsId)
  await boardStore.loadFromFirestore()
}

async function createNew() {
  if (!newName.value.trim()) return
  const wsId = await wsStore.createWorkspace(newName.value.trim(), newIcon.value, newType.value)
  showCreate.value = false
  newName.value = ''
  newIcon.value = '📁'
  newType.value = 'shared'
  if (wsId) await toggle(wsId)
}

function onClickOutside(e) {
  if (switcherRef.value && !switcherRef.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
