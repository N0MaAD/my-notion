<template>
<Teleport to="body">
  <Transition name="drawer">
    <div v-if="modelValue" class="drawer-overlay" @click="close">
      <div class="drawer-panel" @click.stop @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
        <div class="drawer-header">
          <h3 class="drawer-title">Navigation</h3>
          <button class="drawer-close" @click="close">✕</button>
        </div>

        <!-- Workspaces -->
        <div class="drawer-section">
          <div class="drawer-section-label">Espaces</div>
          <div
            v-for="ws in workspaces"
            :key="ws.id"
            class="drawer-ws-item"
            :class="{ active: isWsActive(ws.id) }"
            @click="toggleWs(ws.id)"
          >
            <span class="drawer-ws-icon">{{ ws.icon }}</span>
            <span class="drawer-ws-name">{{ ws.name }}</span>
            <span v-if="isWsActive(ws.id)" class="drawer-check">✓</span>
          </div>
        </div>

        <!-- Notes tree -->
        <div class="drawer-section drawer-notes-tree">
          <div class="drawer-section-label">Notes</div>
          <template v-for="col in store.columns" :key="col.id">
            <div class="drawer-col-title" @click="toggleCol(col.id)">
              <span class="drawer-col-arrow">{{ expandedCols[col.id] ? '▾' : '›' }}</span>
              <span>{{ col.title }}</span>
              <span class="drawer-col-count">{{ col.notes.length }}</span>
            </div>
            <template v-if="expandedCols[col.id]">
              <div
                v-for="note in col.notes"
                :key="note.id"
                class="drawer-note-item"
                :class="{ active: store.activeNoteId === note.id }"
                @click="openNote(note.id)"
              >
                <span class="drawer-note-icon">{{ noteIcon(note) }}</span>
                <span class="drawer-note-title">{{ note.title }}</span>
                <button
                  v-if="hasSubPages(note)"
                  class="drawer-expand-btn"
                  @click.stop="toggleNote(note.id)"
                >{{ expandedNotes[note.id] ? '▾' : '›' }}</button>
              </div>
              <template v-if="expandedNotes[note.id]">
                <div
                  v-for="block in getSubPages(note)"
                  :key="block.id"
                  class="drawer-subpage-item"
                  @click="openSubPage(note.id, block.id)"
                >
                  <span class="drawer-note-icon">📄</span>
                  <span class="drawer-note-title">{{ block.title }}</span>
                </div>
              </template>
            </template>
          </template>
        </div>

        <!-- Actions -->
        <div class="drawer-section drawer-actions">
          <button class="drawer-action-item" @click="$emit('open-settings', 'appearance'); close()">
            <span>⚙️</span><span>Paramètres</span>
          </button>
          <button class="drawer-action-item" @click="$emit('open-settings', 'trash'); close()">
            <span>🗑️</span><span>Corbeille</span>
          </button>
          <button class="drawer-action-item" @click="$emit('open-settings', 'export'); close()">
            <span>📤</span><span>Import / Export</span>
          </button>
          <button class="drawer-action-item" @click="$emit('open-settings', 'shortcuts'); close()">
            <span>⌨️</span><span>Raccourcis</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</Teleport>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../../stores/board.js'
import { useWorkspaceStore } from '../../stores/workspace.js'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'open-settings'])

const store = useBoardStore()
const wsStore = useWorkspaceStore()
const router = useRouter()

const workspaces = computed(() => wsStore.workspaces)
const expandedCols = reactive({})
const expandedNotes = reactive({})

function isWsActive(wsId) { return wsStore.activeWorkspaceIds.includes(wsId) }

async function toggleWs(wsId) {
  if (isWsActive(wsId) && wsStore.activeWorkspaceIds.length <= 1) return
  store.dataLoaded = false
  store.activeNoteId = null
  store.openPagePath = []
  await wsStore.toggleWorkspace(wsId)
  await store.loadFromFirestore()
}

function toggleCol(colId) {
  expandedCols[colId] = !expandedCols[colId]
}

function toggleNote(noteId) {
  expandedNotes[noteId] = !expandedNotes[noteId]
}

function noteIcon(note) {
  const t = note.type || 'note'
  if (t === 'task') return note.checked ? '✅' : '☑️'
  if (t === 'date') return '📅'
  return '📄'
}

function hasSubPages(note) {
  return note.blocks && note.blocks.some(b => b.type === 'page')
}

function getSubPages(note) {
  if (!note.blocks) return []
  return note.blocks.filter(b => b.type === 'page')
}

function openNote(noteId) {
  router.push('/notes/' + noteId)
  close()
}

function openSubPage(noteId, blockId) {
  store.activeNoteId = noteId
  store.openPagePath = [blockId]
  router.push('/notes/' + noteId)
  close()
}

function close() {
  emit('update:modelValue', false)
}

let touchStartX = 0
function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
}
function onTouchMove() {}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (dx < -80) close()
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.drawer-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 85vw;
  max-width: 320px;
  background: var(--bg-primary, #0f0f23);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  flex-shrink: 0;
}

.drawer-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
  margin: 0;
}

.drawer-close {
  background: none;
  border: none;
  color: var(--text-secondary, #8892b0);
  font-size: 1.2rem;
  padding: 8px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
}

.drawer-close:active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

.drawer-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.05));
}

.drawer-section-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #64748b);
  margin-bottom: 8px;
  font-weight: 600;
}

.drawer-ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  min-height: 44px;
  cursor: pointer;
  color: var(--text-primary, #e2e8f0);
  transition: background 0.15s;
}

.drawer-ws-item:active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

.drawer-ws-item.active {
  background: rgba(56, 189, 248, 0.1);
}

.drawer-ws-icon {
  font-size: 1.2rem;
}

.drawer-ws-name {
  flex: 1;
  font-size: 0.9rem;
}

.drawer-check {
  color: var(--accent, #38bdf8);
  font-weight: 600;
}

.drawer-notes-tree {
  flex: 1;
  overflow-y: auto;
}

.drawer-col-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary, #8892b0);
  cursor: pointer;
  min-height: 40px;
  border-radius: 6px;
}

.drawer-col-title:active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

.drawer-col-arrow {
  width: 16px;
  text-align: center;
  font-size: 0.7rem;
}

.drawer-col-count {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--text-muted, #64748b);
  font-weight: 400;
}

.drawer-note-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 28px;
  min-height: 44px;
  cursor: pointer;
  border-radius: 6px;
  color: var(--text-primary, #e2e8f0);
  transition: background 0.15s;
}

.drawer-note-item:active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

.drawer-note-item.active {
  background: rgba(56, 189, 248, 0.08);
  color: var(--accent, #38bdf8);
}

.drawer-note-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.drawer-note-title {
  flex: 1;
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer-expand-btn {
  background: none;
  border: none;
  color: var(--text-muted, #64748b);
  font-size: 0.7rem;
  padding: 4px 8px;
  min-width: 32px;
  min-height: 32px;
  cursor: pointer;
}

.drawer-subpage-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 48px;
  min-height: 40px;
  cursor: pointer;
  border-radius: 6px;
  color: var(--text-secondary, #8892b0);
  font-size: 0.84rem;
}

.drawer-subpage-item:active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

.drawer-actions {
  flex-shrink: 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

.drawer-action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  min-height: 44px;
  border: none;
  background: none;
  color: var(--text-secondary, #8892b0);
  font-size: 0.88rem;
  cursor: pointer;
  border-radius: 8px;
  text-align: left;
}

.drawer-action-item:active {
  background: var(--bg-hover, rgba(255,255,255,0.05));
}

/* Transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(-100%);
}
</style>
