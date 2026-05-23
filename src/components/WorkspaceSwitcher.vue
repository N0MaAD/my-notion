<template>
<div class="ws-switcher" ref="switcherRef">
  <button class="ws-current" @click="open = !open">
    <span class="ws-current-icons">
      <span v-for="ws in activeWorkspaces" :key="ws.id" class="ws-current-icon"><PhIcon :name="ws.icon" :size="18" /></span>
    </span>
    <span class="ws-current-name">{{ label }}</span>
    <span class="ws-current-arrow"><PhCaretUp v-if="open" :size="12" /><PhCaretDown v-else :size="12" /></span>
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
          <PhCheck v-if="isActive(ws.id)" :size="14" />
        </span>
        <span class="ws-item-icon"><PhIcon :name="ws.icon" :size="18" /></span>
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
        <span class="ws-action-icon"><PhGear :size="14" /></span>
        <span>Gérer les espaces</span>
      </button>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showCreate" class="ws-modal-overlay" @click="showCreate = false">
      <div class="ws-modal" @click.stop>
        <div class="ws-modal-header">
          <h3>Nouvel espace de travail</h3>
          <button class="ws-modal-close" @click="showCreate = false"><PhX :size="14" /></button>
        </div>
        <div class="ws-modal-body">
          <label class="ws-modal-label">Nom</label>
          <input v-model="newName" class="ws-modal-input" placeholder="Ex: Famille, Projet X..."
            @keydown.enter="createNew" autofocus />
          <label class="ws-modal-label">Icône</label>
          <div class="ws-icon-grid">
            <button v-for="icon in ICONS" :key="icon" class="ws-icon-btn"
              :class="{ active: newIcon === icon }" @click="newIcon = icon"><PhIcon :name="icon" :size="18" /></button>
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
import { PhCaretUp, PhCaretDown, PhCheck, PhGear, PhX } from '@phosphor-icons/vue'
import PhIcon from './PhIcon.vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useBoardStore } from '../stores/board.js'

const emit = defineEmits(['manage'])
const wsStore = useWorkspaceStore()
const boardStore = useBoardStore()

const open      = ref(false)
const showCreate = ref(false)
const newName   = ref('')
const newIcon   = ref('folder')
const switcherRef = ref(null)

const ICONS = ['house-simple', 'suitcase', 'users', 'folder', 'graduation-cap', 'paint-brush-broad', 'microscope', 'barricade', 'game-controller', 'equalizer', 'books', 'planet', 'heartbeat', 'sparkle', 'rocket-launch', 'lightbulb']

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
  const wsId = await wsStore.createWorkspace(newName.value.trim(), newIcon.value)
  showCreate.value = false
  newName.value = ''
  newIcon.value = 'folder'
  if (wsId) await toggle(wsId)
}

function onClickOutside(e) {
  if (switcherRef.value && !switcherRef.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
