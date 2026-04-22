<template>
<Teleport to="body">
  <div class="settings-page">
    <!-- Sidebar gauche -->
    <aside class="settings-sidebar">
      <div class="settings-sidebar-header">
        <div class="settings-sidebar-user">
          <img
            v-if="authStore.user?.photoURL"
            :src="authStore.user.photoURL"
            class="settings-avatar"
            referrerpolicy="no-referrer"
          />
          <div class="settings-sidebar-info">
            <span class="settings-sidebar-name">{{ authStore.user?.displayName }}</span>
            <span class="settings-sidebar-email">{{ authStore.user?.email }}</span>
          </div>
        </div>
      </div>

      <nav class="settings-nav">
        <div class="settings-nav-section-label">Préférences</div>
        <button
          v-for="item in prefItems"
          :key="item.id"
          class="settings-nav-item"
          :class="{ active: activeSection === item.id }"
          @click="activeSection = item.id"
        >
          <span class="settings-nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
        <div class="settings-nav-section-label">Espaces de travail</div>
        <button
          class="settings-nav-item"
          :class="{ active: activeSection === 'workspaces' }"
          @click="activeSection = 'workspaces'"
        >
          <span class="settings-nav-icon">🏢</span>
          <span>Mes espaces</span>
        </button>
        <button
          v-if="wsStore.activeWorkspace"
          class="settings-nav-item"
          :class="{ active: activeSection === 'members' }"
          @click="activeSection = 'members'; loadMembers()"
        >
          <span class="settings-nav-icon">👥</span>
          <span>Membres</span>
        </button>
      </nav>

      <div class="settings-sidebar-footer">
        <button class="settings-nav-item danger" @click="$emit('logout')">
          <span class="settings-nav-icon">🚪</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>

    <!-- Contenu principal -->
    <main class="settings-main">
      <div class="settings-main-header">
        <h1 class="settings-main-title">{{ currentItem?.label || 'Paramètres' }}</h1>
        <button class="settings-close-btn" @click="$emit('close')" title="Fermer (Échap)">✕</button>
      </div>

      <!-- Apparence -->
      <div v-if="activeSection === 'appearance'" class="settings-section">
        <div class="settings-block">
          <h3 class="settings-block-title">Thème</h3>
          <p class="settings-block-desc">Choisis l'apparence de l'interface</p>
          <div class="settings-themes">
            <button
              v-for="t in THEMES"
              :key="t.id"
              class="settings-theme-card"
              :class="{ active: themeStore.theme === t.id }"
              @click="themeStore.setTheme(t.id)"
            >
              <div class="settings-theme-preview" :data-theme-preview="t.id">
                <div class="stp-col"></div>
                <div class="stp-col"></div>
                <div class="stp-col"></div>
              </div>
              <div class="settings-theme-info">
                <span class="settings-theme-icon">{{ t.icon }}</span>
                <span class="settings-theme-label">{{ t.label }}</span>
                <span v-if="themeStore.theme === t.id" class="settings-theme-check">✓</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Corbeille -->
      <div v-else-if="activeSection === 'trash'" class="settings-section">
        <div class="settings-block">
          <h3 class="settings-block-title">Corbeille</h3>
          <p class="settings-block-desc">Les notes supprimées sont conservées ici pendant {{ TRASH_RETENTION_DAYS }} jours</p>
          <div v-if="trashNotes.length === 0" class="settings-empty">
            <span class="settings-empty-icon">🗑️</span>
            <p>La corbeille est vide</p>
          </div>
          <div v-else class="settings-trash-list">
            <div class="settings-trash-actions">
              <span class="settings-trash-count">{{ trashNotes.length }} note{{ trashNotes.length > 1 ? 's' : '' }}</span>
              <button class="btn btn-danger" @click="emptyTrash">Vider la corbeille</button>
            </div>
            <div
              v-for="note in trashNotes"
              :key="note.id"
              class="settings-trash-item"
            >
              <div class="settings-trash-item-info">
                <span class="settings-trash-item-title">{{ note.title || 'Sans titre' }}</span>
                <span class="settings-trash-item-date">Supprimée {{ formatDeletedDate(note.deletedAt) }}</span>
              </div>
              <div class="settings-trash-item-actions">
                <button class="btn btn-ghost" @click="restoreNote(note)" title="Restaurer">↩</button>
                <button class="btn btn-danger" @click="deleteForever(note)" title="Supprimer définitivement">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Workspaces -->
      <div v-else-if="activeSection === 'workspaces'" class="settings-section">
        <div class="settings-block">
          <h3 class="settings-block-title">Espaces de travail</h3>
          <p class="settings-block-desc">Gère tes espaces pour organiser tes notes</p>

          <div class="ws-settings-list">
            <div
              v-for="ws in wsStore.workspaces"
              :key="ws.id"
              class="ws-settings-item"
              :class="{ active: ws.id === wsStore.activeWorkspaceId }"
            >
              <div class="ws-settings-item-left">
                <span class="ws-settings-icon">{{ ws.icon }}</span>
                <div class="ws-settings-info">
                  <template v-if="editingWsId === ws.id">
                    <input
                      v-model="editWsName"
                      class="ws-settings-edit-input"
                      @keydown.enter="saveEditWs(ws.id)"
                      @keydown.escape="editingWsId = null"
                      ref="editInput"
                    />
                  </template>
                  <template v-else>
                    <span class="ws-settings-name">{{ ws.name }}</span>
                    <span class="ws-settings-meta">
                      {{ ws.role === 'owner' ? 'Propriétaire' : ws.role === 'editor' ? 'Éditeur' : 'Lecteur' }}
                      · {{ ws.memberCount }} membre{{ ws.memberCount > 1 ? 's' : '' }}
                    </span>
                  </template>
                </div>
              </div>
              <div class="ws-settings-item-actions">
                <button
                  v-if="ws.id === wsStore.activeWorkspaceId"
                  class="ws-settings-badge"
                >Actif</button>
                <button
                  v-if="ws.role === 'owner'"
                  class="btn btn-ghost btn-sm"
                  @click="startEditWs(ws)"
                  title="Renommer"
                >✏️</button>
                <button
                  v-if="ws.role === 'owner'"
                  class="btn btn-ghost btn-sm"
                  @click="showIconPicker = ws.id"
                  title="Changer l'icône"
                >{{ ws.icon }}</button>
                <button
                  v-if="ws.role === 'owner' && wsStore.workspaces.length > 1"
                  class="btn btn-danger btn-sm"
                  @click="confirmDeleteWs(ws)"
                  title="Supprimer"
                >✕</button>
                <button
                  v-if="ws.role !== 'owner'"
                  class="btn btn-danger btn-sm"
                  @click="leaveWs(ws)"
                  title="Quitter"
                >Quitter</button>
              </div>
            </div>
          </div>

          <!-- Icon picker popover -->
          <div v-if="showIconPicker" class="ws-icon-picker-overlay" @click="showIconPicker = null">
            <div class="ws-icon-picker" @click.stop>
              <div class="ws-icon-picker-grid">
                <button
                  v-for="icon in ICONS"
                  :key="icon"
                  class="ws-icon-picker-btn"
                  @click="changeWsIcon(showIconPicker, icon)"
                >{{ icon }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Members -->
      <div v-else-if="activeSection === 'members'" class="settings-section">
        <div class="settings-block">
          <h3 class="settings-block-title">Membres — {{ wsStore.activeWorkspace?.name }}</h3>
          <p class="settings-block-desc">Invite des personnes pour collaborer sur cet espace</p>

          <div v-if="wsStore.activeWorkspace?.role === 'owner'" class="ws-invite-form">
            <input
              v-model="inviteEmail"
              class="ws-invite-input"
              placeholder="Email du membre à inviter..."
              @keydown.enter="doInvite"
            />
            <select v-model="inviteRole" class="ws-invite-role">
              <option value="editor">Éditeur</option>
              <option value="viewer">Lecteur</option>
            </select>
            <button class="btn btn-accent" @click="doInvite" :disabled="!inviteEmail.trim()">Inviter</button>
          </div>
          <div v-if="inviteMessage" class="ws-invite-message" :class="inviteMessageType">{{ inviteMessage }}</div>

          <div class="ws-members-list">
            <div
              v-for="member in currentMembers"
              :key="member.uid"
              class="ws-member-item"
            >
              <div class="ws-member-left">
                <img v-if="member.photoURL" :src="member.photoURL" class="ws-member-avatar" referrerpolicy="no-referrer" />
                <div v-else class="ws-member-avatar ws-member-avatar-placeholder">{{ (member.displayName || member.email || '?')[0] }}</div>
                <div class="ws-member-info">
                  <span class="ws-member-name">{{ member.displayName || member.email }}</span>
                  <span class="ws-member-email">{{ member.email }}</span>
                </div>
              </div>
              <div class="ws-member-right">
                <span class="ws-member-role" :class="'role-' + member.role">
                  {{ member.role === 'owner' ? 'Propriétaire' : member.role === 'editor' ? 'Éditeur' : 'Lecteur' }}
                </span>
                <button
                  v-if="wsStore.activeWorkspace?.role === 'owner' && member.role !== 'owner'"
                  class="btn btn-danger btn-sm"
                  @click="doRemoveMember(member.uid)"
                  title="Retirer"
                >✕</button>
              </div>
            </div>
          </div>

          <!-- Pending invites -->
          <div v-if="pendingInvites.length > 0" class="ws-pending">
            <h4 class="ws-pending-title">Invitations en attente</h4>
            <div v-for="inv in pendingInvites" :key="inv.email" class="ws-pending-item">
              <span class="ws-pending-email">{{ inv.email }}</span>
              <span class="ws-pending-role">{{ inv.role === 'editor' ? 'Éditeur' : 'Lecteur' }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useThemeStore, THEMES } from '../stores/theme.js'
import { useAuthStore } from '../stores/auth.js'
import { useBoardStore } from '../stores/board.js'
import { useWorkspaceStore } from '../stores/workspace.js'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

const props = defineProps({
  initialSection: { type: String, default: 'appearance' }
})

const emit = defineEmits(['close', 'logout'])

const themeStore = useThemeStore()
const authStore = useAuthStore()
const store = useBoardStore()
const wsStore = useWorkspaceStore()

const TRASH_RETENTION_DAYS = 30

const ICONS = ['🏠', '💼', '👥', '📁', '🎓', '🎨', '🔬', '🏗️', '🎮', '🎵', '📚', '🌍', '❤️', '⭐', '🚀', '💡']

const prefItems = [
  { id: 'appearance', icon: '🎨', label: 'Apparence' },
  { id: 'trash', icon: '🗑️', label: 'Corbeille' }
]

const allItems = [
  ...prefItems,
  { id: 'workspaces', icon: '🏢', label: 'Mes espaces' },
  { id: 'members', icon: '👥', label: 'Membres' }
]

const activeSection = ref(props.initialSection || 'appearance')
const editingWsId = ref(null)
const editWsName = ref('')
const showIconPicker = ref(null)

const inviteEmail = ref('')
const inviteRole = ref('editor')
const inviteMessage = ref('')
const inviteMessageType = ref('success')

const currentMembers = ref([])
const pendingInvites = ref([])

const currentItem = computed(() => allItems.find(i => i.id === activeSection.value) || prefItems[0])
const trashNotes = computed(() => store.trash || [])

watch(() => props.initialSection, (v) => {
  if (v) activeSection.value = v
})

function formatDeletedDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'aujourd\'hui'
  if (days === 1) return 'hier'
  return `il y a ${days} jours`
}

function restoreNote(note) {
  store.restoreFromTrash(note.id)
}

function deleteForever(note) {
  if (confirm(`Supprimer « ${note.title || 'Sans titre'} » définitivement ?`)) {
    store.deleteForever(note.id)
  }
}

function emptyTrash() {
  if (confirm('Vider la corbeille ? Cette action est irréversible.')) {
    store.emptyTrash()
  }
}

function startEditWs(ws) {
  editingWsId.value = ws.id
  editWsName.value = ws.name
}

async function saveEditWs(wsId) {
  if (editWsName.value.trim()) {
    await wsStore.updateWorkspace(wsId, { name: editWsName.value.trim() })
  }
  editingWsId.value = null
}

async function changeWsIcon(wsId, icon) {
  await wsStore.updateWorkspace(wsId, { icon })
  showIconPicker.value = null
}

async function confirmDeleteWs(ws) {
  if (confirm(`Supprimer l'espace « ${ws.name} » et toutes ses notes ? Cette action est irréversible.`)) {
    await wsStore.deleteWorkspace(ws.id)
    if (wsStore.activeWorkspaceId) {
      store.dataLoaded = false
      store.activeNoteId = null
      store.openPagePath = []
      await store.loadFromFirestore()
    }
  }
}

async function leaveWs(ws) {
  if (confirm(`Quitter l'espace « ${ws.name} » ?`)) {
    await wsStore.removeMember(ws.id, authStore.user.uid)
    if (wsStore.activeWorkspaceId) {
      store.dataLoaded = false
      await store.loadFromFirestore()
    }
  }
}

async function loadMembers() {
  if (!wsStore.activeWorkspaceId) return
  const members = await wsStore.loadWorkspaceMembers(wsStore.activeWorkspaceId)
  currentMembers.value = members

  const wsRef = doc(db, 'workspaces', wsStore.activeWorkspaceId)
  const wsSnap = await getDoc(wsRef)
  if (wsSnap.exists()) {
    pendingInvites.value = wsSnap.data().pendingInvites || []
  }
}

async function doInvite() {
  if (!inviteEmail.value.trim()) return
  inviteMessage.value = ''
  const result = await wsStore.inviteMember(wsStore.activeWorkspaceId, inviteEmail.value.trim(), inviteRole.value)
  if (result.success) {
    if (result.pending) {
      inviteMessage.value = `Invitation envoyée à ${inviteEmail.value} (sera ajouté à sa prochaine connexion)`
    } else {
      inviteMessage.value = `${inviteEmail.value} ajouté avec succès !`
    }
    inviteMessageType.value = 'success'
    inviteEmail.value = ''
    await loadMembers()
  } else {
    inviteMessage.value = result.error
    inviteMessageType.value = 'error'
  }
}

async function doRemoveMember(uid) {
  if (confirm('Retirer ce membre de l\'espace ?')) {
    await wsStore.removeMember(wsStore.activeWorkspaceId, uid)
    await loadMembers()
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>
