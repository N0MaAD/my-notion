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

      <!-- Raccourcis -->
      <div v-else-if="activeSection === 'shortcuts'" class="settings-section">
        <div class="settings-block">
          <h3 class="settings-block-title">Raccourcis clavier</h3>
          <p class="settings-block-desc">Tous les raccourcis disponibles dans l'application</p>
          <div class="shortcuts-list">
            <div v-for="group in SHORTCUT_GROUPS" :key="group.label" class="shortcuts-group">
              <div class="shortcuts-group-label">{{ group.label }}</div>
              <div v-for="s in group.items" :key="s.key" class="shortcuts-row">
                <span class="shortcuts-desc">{{ s.desc }}</span>
                <kbd class="shortcuts-kbd">{{ s.key }}</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Import / Export -->
      <div v-else-if="activeSection === 'export'" class="settings-section">
        <div class="settings-block">
          <h3 class="settings-block-title">Exporter</h3>
          <p class="settings-block-desc">Télécharge toutes tes notes dans le format de ton choix</p>
          <div class="export-options">
            <button class="btn btn-accent" @click="doExportMarkdown">📝 Markdown</button>
            <button class="btn btn-accent" @click="doExportCSV">📊 CSV</button>
            <button class="btn btn-accent" @click="doExportHTML">🌐 HTML</button>
            <button class="btn btn-ghost" @click="doExportJSON">📄 JSON</button>
          </div>
        </div>

        <div class="settings-block">
          <h3 class="settings-block-title">Importer</h3>
          <p class="settings-block-desc">Importe des notes depuis un fichier</p>
          <div class="import-options">
            <label class="import-option">
              <input type="file" accept=".json" class="import-file-input" @change="doImportJSON" />
              <span class="import-option-card">
                <span class="import-option-icon">📄</span>
                <span class="import-option-label">JSON (My Notion)</span>
                <span class="import-option-desc">Fichier exporté depuis My Notion</span>
              </span>
            </label>
            <label class="import-option">
              <input type="file" accept=".json" class="import-file-input" @change="doImportTrello" />
              <span class="import-option-card">
                <span class="import-option-icon">📋</span>
                <span class="import-option-label">Trello (JSON)</span>
                <span class="import-option-desc">Export JSON d'un tableau Trello</span>
              </span>
            </label>
            <label class="import-option">
              <input type="file" accept=".md,.txt" multiple class="import-file-input" @change="doImportMarkdown" />
              <span class="import-option-card">
                <span class="import-option-icon">📝</span>
                <span class="import-option-label">Markdown / Notion</span>
                <span class="import-option-desc">Fichiers .md exportés depuis Notion</span>
              </span>
            </label>
          </div>
          <div v-if="importMessage" class="import-message" :class="importMessageType">{{ importMessage }}</div>
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
              :class="{ active: ws.id === wsStore.activeWorkspaceIds[0] }"
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
                  v-if="ws.id === wsStore.activeWorkspaceIds[0]"
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
  { id: 'shortcuts', icon: '⌨️', label: 'Raccourcis' },
  { id: 'export', icon: '📤', label: 'Import / Export' },
  { id: 'trash', icon: '🗑️', label: 'Corbeille' }
]

const allItems = [
  ...prefItems,
  { id: 'workspaces', icon: '🏢', label: 'Mes espaces' },
  { id: 'members', icon: '👥', label: 'Membres' }
]

const SHORTCUT_GROUPS = [
  {
    label: 'Navigation',
    items: [
      { key: 'Ctrl + K', desc: 'Palette de commandes / recherche' },
      { key: 'Alt + N', desc: 'Capture rapide' },
      { key: '?', desc: 'Afficher les raccourcis (hors champ texte)' },
      { key: 'Échap', desc: 'Fermer la note / modal actif' },
    ]
  },
  {
    label: 'Actions',
    items: [
      { key: 'Ctrl + Z', desc: 'Annuler la dernière action' },
      { key: 'Ctrl + Y', desc: 'Rétablir' },
      { key: 'Ctrl + Shift + Z', desc: 'Rétablir (alternatif)' },
    ]
  },
  {
    label: 'Éditeur de note',
    items: [
      { key: '/', desc: 'Menu slash — insérer un bloc' },
      { key: 'Ctrl + B', desc: 'Gras' },
      { key: 'Ctrl + I', desc: 'Italique' },
      { key: 'Ctrl + U', desc: 'Souligné' },
      { key: 'Ctrl + Shift + S', desc: 'Barré' },
      { key: 'Ctrl + E', desc: 'Code inline' },
      { key: 'Ctrl + Shift + 7', desc: 'Liste ordonnée' },
      { key: 'Ctrl + Shift + 8', desc: 'Liste à puces' },
      { key: 'Ctrl + Shift + 9', desc: 'Liste de tâches' },
    ]
  }
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
const importMessage = ref('')
const importMessageType = ref('success')

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

// ─── Export ───
function cleanForExport(obj) {
  const { _wsId, _wsIcon, _wsName, ...clean } = obj
  return clean
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function blocksToText(blocks) {
  if (!blocks?.length) return ''
  let text = ''
  for (const b of blocks) {
    if (b.content) text += b.content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() + '\n\n'
    if (b.type === 'page') text += `### ${b.title || 'Sans titre'}\n\n` + blocksToText(b.blocks)
  }
  return text
}

function doExportMarkdown() {
  let md = `# My Notion — Export ${new Date().toLocaleDateString('fr-FR')}\n\n`
  for (const col of store.columns) {
    md += `## ${col.title}\n\n`
    for (const note of col.notes) {
      md += `### ${note.title || 'Sans titre'}\n\n`
      md += blocksToText(note.blocks)
      md += '---\n\n'
    }
  }
  downloadFile(md, `my-notion-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')
  store.addNotification('Export Markdown téléchargé', 'info')
}

function doExportCSV() {
  const escape = v => `"${(v || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  let csv = 'Colonne,Titre,Type,Contenu,Tags\n'
  for (const col of store.columns) {
    for (const note of col.notes) {
      const content = blocksToText(note.blocks).trim()
      const noteTags = (note.tagIds || []).map(id => store.tags.find(t => t.id === id)?.name).filter(Boolean).join(', ')
      csv += `${escape(col.title)},${escape(note.title)},${escape(note.type)},${escape(content)},${escape(noteTags)}\n`
    }
  }
  downloadFile('﻿' + csv, `my-notion-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
  store.addNotification('Export CSV téléchargé', 'info')
}

function doExportHTML() {
  let body = ''
  for (const col of store.columns) {
    body += `<h2>${col.title}</h2>\n`
    for (const note of col.notes) {
      body += `<div class="note"><h3>${note.title || 'Sans titre'}</h3>\n`
      for (const b of (note.blocks || [])) {
        if (b.content) body += `<p>${b.content}</p>\n`
        if (b.type === 'page') body += `<h4>${b.title || ''}</h4>\n`
      }
      body += '</div><hr>\n'
    }
  }
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>My Notion Export</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#222}
h2{color:#0ea5e9;border-bottom:2px solid #0ea5e9;padding-bottom:.3rem}h3{margin:.5rem 0}
.note{margin:1rem 0;padding:.5rem 0}hr{border:none;border-top:1px solid #ddd;margin:1.5rem 0}</style>
</head><body><h1>My Notion — Export ${new Date().toLocaleDateString('fr-FR')}</h1>\n${body}</body></html>`
  downloadFile(html, `my-notion-${new Date().toISOString().slice(0, 10)}.html`, 'text/html')
  store.addNotification('Export HTML téléchargé', 'info')
}

function doExportJSON() {
  const data = {
    version: 1, app: 'my-notion', exportedAt: new Date().toISOString(),
    columns: store.columns.map(col => ({ ...cleanForExport(col), notes: col.notes.map(n => cleanForExport(n)) })),
    tags: store.tags.map(t => cleanForExport(t)),
    trash: store.trash.map(t => cleanForExport(t))
  }
  downloadFile(JSON.stringify(data, null, 2), `my-notion-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  store.addNotification('Export JSON téléchargé', 'info')
}

// ─── Import ───
async function doImportJSON(e) {
  const file = e.target.files?.[0]
  if (!file) return
  importMessage.value = ''
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.columns || !Array.isArray(data.columns)) throw new Error('Format invalide')
    let noteCount = 0
    for (const col of data.columns) {
      const id = crypto.randomUUID()
      const notes = (col.notes || []).map(n => ({ ...n, id: crypto.randomUUID() }))
      noteCount += notes.length
      store.columns.push({ id, title: col.title || 'Importé', notes })
    }
    if (data.tags) {
      for (const tag of data.tags) {
        if (!store.tags.some(t => t.name === tag.name)) {
          store.tags.push({ ...tag, id: crypto.randomUUID() })
        }
      }
    }
    importMessage.value = `Import réussi : ${noteCount} notes importées`
    importMessageType.value = 'success'
  } catch (err) {
    importMessage.value = 'Erreur : ' + err.message
    importMessageType.value = 'error'
  }
  e.target.value = ''
}

async function doImportTrello(e) {
  const file = e.target.files?.[0]
  if (!file) return
  importMessage.value = ''
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.lists || !data.cards) throw new Error('Format Trello invalide')
    const listsMap = {}
    for (const list of data.lists) {
      if (list.closed) continue
      listsMap[list.id] = { id: crypto.randomUUID(), title: list.name, notes: [] }
    }
    let noteCount = 0
    for (const card of data.cards) {
      if (card.closed || !listsMap[card.idList]) continue
      const blocks = []
      if (card.desc) blocks.push({ id: crypto.randomUUID(), type: 'text', content: card.desc.replace(/\n/g, '<br>') })
      listsMap[card.idList].notes.push({ id: crypto.randomUUID(), title: card.name, type: 'note', blocks })
      noteCount++
    }
    for (const col of Object.values(listsMap)) {
      store.columns.push( col)
    }
    importMessage.value = `Import Trello réussi : ${Object.keys(listsMap).length} colonnes, ${noteCount} notes`
    importMessageType.value = 'success'
  } catch (err) {
    importMessage.value = 'Erreur : ' + err.message
    importMessageType.value = 'error'
  }
  e.target.value = ''
}

async function doImportMarkdown(e) {
  const files = e.target.files
  if (!files?.length) return
  importMessage.value = ''
  try {
    const colId = crypto.randomUUID()
    const notes = []
    for (const file of files) {
      const text = await file.text()
      const lines = text.split('\n')
      let title = file.name.replace(/\.(md|txt)$/i, '')
      let contentLines = lines
      if (lines[0]?.startsWith('# ')) {
        title = lines[0].replace(/^#+\s*/, '')
        contentLines = lines.slice(1)
      }
      const content = contentLines.join('\n').trim()
      const blocks = content ? [{ id: crypto.randomUUID(), type: 'text', content: content.replace(/\n/g, '<br>') }] : []
      notes.push({ id: crypto.randomUUID(), title, type: 'note', blocks })
    }
    store.columns.push( { id: colId, title: 'Import Markdown', notes })
    importMessage.value = `Import réussi : ${notes.length} note${notes.length > 1 ? 's' : ''}`
    importMessageType.value = 'success'
  } catch (err) {
    importMessage.value = 'Erreur : ' + err.message
    importMessageType.value = 'error'
  }
  e.target.value = ''
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
    if (wsStore.activeWorkspaceIds[0]) {
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
    if (wsStore.activeWorkspaceIds[0]) {
      store.dataLoaded = false
      await store.loadFromFirestore()
    }
  }
}

async function loadMembers() {
  if (!wsStore.activeWorkspaceIds[0]) return
  const members = await wsStore.loadWorkspaceMembers(wsStore.activeWorkspaceIds[0])
  currentMembers.value = members
  pendingInvites.value = await wsStore.getPendingInvites(wsStore.activeWorkspaceIds[0])
}

async function doInvite() {
  if (!inviteEmail.value.trim()) return
  inviteMessage.value = ''
  const result = await wsStore.inviteMember(wsStore.activeWorkspaceIds[0], inviteEmail.value.trim(), inviteRole.value)
  if (result.success) {
    inviteMessage.value = `Invitation envoyée à ${inviteEmail.value} — sera ajouté à sa prochaine connexion`
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
    await wsStore.removeMember(wsStore.activeWorkspaceIds[0], uid)
    await loadMembers()
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>
