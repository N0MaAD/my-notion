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
          v-for="item in navItems"
          :key="item.id"
          class="settings-nav-item"
          :class="{ active: activeSection === item.id }"
          @click="activeSection = item.id"
        >
          <span class="settings-nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
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
        <h1 class="settings-main-title">{{ currentItem.label }}</h1>
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
    </main>
  </div>
</Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useThemeStore, THEMES } from '../stores/theme.js'
import { useAuthStore } from '../stores/auth.js'
import { useBoardStore } from '../stores/board.js'

const emit = defineEmits(['close', 'logout'])

const themeStore = useThemeStore()
const authStore = useAuthStore()
const store = useBoardStore()

const TRASH_RETENTION_DAYS = 30

const navItems = [
  { id: 'appearance', icon: '🎨', label: 'Apparence' },
  { id: 'trash', icon: '🗑️', label: 'Corbeille' }
]

const activeSection = ref('appearance')

const currentItem = computed(() => navItems.find(i => i.id === activeSection.value) || navItems[0])

const trashNotes = computed(() => store.trash || [])

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

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>
