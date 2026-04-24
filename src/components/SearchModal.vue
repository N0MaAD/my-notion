<template>
<Teleport to="body">
  <div v-if="isOpen" class="search-overlay" @click.self="close">
    <div class="search-modal">
      <div class="search-input-row">
        <span class="search-icon">🔍</span>
        <input
          ref="inputRef"
          class="search-input"
          v-model="query"
          placeholder="Rechercher ou exécuter une commande…"
          @keydown.escape="close"
          @keydown.down.prevent="moveDown"
          @keydown.up.prevent="moveUp"
          @keydown.enter.prevent="selectItem"
        />
        <kbd class="search-kbd">ESC</kbd>
      </div>

      <!-- Command palette (empty query) -->
      <template v-if="!query.trim()">
        <div v-if="recentNotes.length" class="search-section">
          <div class="search-section-label">Récents</div>
          <div
            v-for="(item, i) in recentNotes"
            :key="'r' + item.id"
            class="search-result-item"
            :class="{ active: selectedIndex === i }"
            @click="openResult(item)"
            @mouseenter="selectedIndex = i"
          >
            <span class="search-result-icon">📄</span>
            <div class="search-result-text">
              <span class="search-result-title">{{ item.title || 'Sans titre' }}</span>
              <span class="search-result-path">{{ item.path }}</span>
            </div>
          </div>
        </div>

        <div class="search-section">
          <div class="search-section-label">Actions</div>
          <div
            v-for="(cmd, i) in commands"
            :key="cmd.id"
            class="search-result-item"
            :class="{ active: selectedIndex === recentNotes.length + i }"
            @click="runCommand(cmd)"
            @mouseenter="selectedIndex = recentNotes.length + i"
          >
            <span class="search-result-icon">{{ cmd.icon }}</span>
            <div class="search-result-text">
              <span class="search-result-title">{{ cmd.label }}</span>
            </div>
            <kbd v-if="cmd.shortcut" class="search-item-kbd">{{ cmd.shortcut }}</kbd>
          </div>
        </div>
      </template>

      <!-- Search results -->
      <template v-else>
        <div v-if="results.length" class="search-results">
          <div class="search-results-count">{{ results.length }} résultat{{ results.length > 1 ? 's' : '' }}</div>
          <div
            v-for="(result, i) in results"
            :key="result.noteId + (result.pagePath?.join('') || '') + i"
            class="search-result-item"
            :class="{ active: selectedIndex === i }"
            @click="openResult(result)"
            @mouseenter="selectedIndex = i"
          >
            <span class="search-result-icon">{{ result.type === 'note' ? '📄' : '📑' }}</span>
            <div class="search-result-text">
              <span class="search-result-title" v-html="highlight(result.title)"></span>
              <span class="search-result-path">
                {{ result.path }}
                <span v-if="wsStore.multiWorkspaceActive && result.wsIcon" class="search-ws-badge">{{ result.wsIcon }}</span>
              </span>
              <span v-if="result.snippet" class="search-result-snippet" v-html="highlight(result.snippet)"></span>
            </div>
          </div>
        </div>
        <div v-else class="search-empty">Aucun résultat pour « {{ query }} »</div>
      </template>
    </div>
  </div>
</Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useBoardStore } from '../stores/board.js'
import { useWorkspaceStore } from '../stores/workspace.js'

const store = useBoardStore()
const wsStore = useWorkspaceStore()
const emit = defineEmits(['navigate', 'open-settings', 'quick-capture'])

const isOpen = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)

// ─── Recent notes (persisted in localStorage) ───
const MAX_RECENT = 6
const recentNoteIds = ref(JSON.parse(localStorage.getItem('mn_recent_notes') || '[]'))

function addRecent(noteId) {
  const ids = recentNoteIds.value.filter(id => id !== noteId)
  ids.unshift(noteId)
  recentNoteIds.value = ids.slice(0, MAX_RECENT * 2)
  localStorage.setItem('mn_recent_notes', JSON.stringify(recentNoteIds.value))
}

const recentNotes = computed(() => {
  const found = []
  for (const id of recentNoteIds.value) {
    for (const col of store.columns) {
      if (col.archive) continue
      const note = col.notes.find(n => n.id === id)
      if (note) { found.push({ id, type: 'note', title: note.title, path: col.title, noteId: id, pagePath: [] }); break }
    }
    if (found.length >= MAX_RECENT) break
  }
  return found
})

// ─── Commands ───
const commands = computed(() => [
  { id: 'quick-capture', icon: '⚡', label: 'Capture rapide',       shortcut: 'Ctrl+Shift+N', action: () => { emit('quick-capture'); close() } },
  { id: 'notes',         icon: '📋', label: 'Vue Notes',            action: () => { emit('navigate', 'notes');    close() } },
  { id: 'agenda',        icon: '📅', label: 'Vue Agenda',           action: () => { emit('navigate', 'agenda');   close() } },
  { id: 'tags',          icon: '🏷️',  label: 'Vue Tags',            action: () => { emit('navigate', 'tags');     close() } },
  { id: 'settings',      icon: '⚙️',  label: 'Paramètres',          action: () => { emit('open-settings', 'appearance'); close() } },
  { id: 'shortcuts',     icon: '⌨️',  label: 'Raccourcis clavier',  shortcut: '?', action: () => { emit('open-settings', 'shortcuts'); close() } },
  { id: 'trash',         icon: '🗑️',  label: 'Corbeille',           action: () => { emit('open-settings', 'trash'); close() } },
  { id: 'export',        icon: '📤',  label: 'Import / Export',     action: () => { emit('open-settings', 'export'); close() } },
])

function runCommand(cmd) { cmd.action() }

// ─── Full-text search across all blocks ───
function getSnippet(blocks, q) {
  if (!blocks) return null
  for (const block of blocks) {
    if (block.content) {
      const text = block.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const idx = text.toLowerCase().indexOf(q)
      if (idx !== -1) {
        const s = Math.max(0, idx - 35)
        const e = Math.min(text.length, idx + q.length + 70)
        return (s > 0 ? '…' : '') + text.slice(s, e) + (e < text.length ? '…' : '')
      }
    }
    if (block.blocks) {
      const nested = getSnippet(block.blocks, q)
      if (nested) return nested
    }
  }
  return null
}

function searchSubPages(page, pathStr, noteId, currentPath, q, found, wsIcon) {
  if (!page.blocks) return
  for (const block of page.blocks) {
    if (block.type !== 'page') continue
    const blockPath = [...currentPath, block.id]
    const titleMatch = (block.title || '').toLowerCase().includes(q)
    const snippet = getSnippet(block.blocks, q)
    if (titleMatch || snippet) {
      found.push({
        id: block.id, type: 'subpage',
        title: block.title || 'Sans titre',
        path: pathStr, snippet,
        noteId, pagePath: blockPath, wsIcon
      })
    }
    searchSubPages(block, pathStr + ' › ' + (block.title || '?'), noteId, blockPath, q, found, wsIcon)
  }
}

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 1) return []
  const found = []
  for (const col of store.columns) {
    const ws = wsStore.workspaces.find(w => w.id === col._wsId)
    const wsIcon = ws?.icon
    for (const note of col.notes) {
      const titleMatch = (note.title || '').toLowerCase().includes(q)
      const snippet = getSnippet(note.blocks, q)
      if (titleMatch || snippet) {
        found.push({
          id: note.id, type: 'note',
          title: note.title || 'Sans titre',
          path: col.title, snippet: titleMatch ? snippet : snippet,
          noteId: note.id, pagePath: [], wsIcon
        })
      }
      searchSubPages(note, col.title + ' › ' + (note.title || '?'), note.id, [], q, found, wsIcon)
    }
  }
  return found.slice(0, 25)
})

function highlight(text) {
  if (!text || !query.value) return text
  const q = query.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!q) return text
  return text.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')
}

// ─── Keyboard navigation ───
const totalItems = computed(() =>
  query.value.trim()
    ? results.value.length
    : recentNotes.value.length + commands.value.length
)

watch(query, () => { selectedIndex.value = 0 })

function moveDown() { if (selectedIndex.value < totalItems.value - 1) selectedIndex.value++ }
function moveUp()   { if (selectedIndex.value > 0) selectedIndex.value-- }

function selectItem() {
  if (query.value.trim()) {
    const r = results.value[selectedIndex.value]
    if (r) openResult(r)
  } else {
    const all = [...recentNotes.value, ...commands.value]
    const item = all[selectedIndex.value]
    if (!item) return
    if (item.noteId !== undefined && !item.action) openResult(item)
    else runCommand(item)
  }
}

function openResult(result) {
  addRecent(result.noteId)
  store.activeNoteId = result.noteId
  store.openPagePath = result.pagePath || []
  close()
}

// ─── Open / close ───
function open() {
  isOpen.value = true
  query.value = ''
  selectedIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function close() {
  isOpen.value = false
  query.value = ''
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); isOpen.value ? close() : open() }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>
