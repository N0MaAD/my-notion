<template>
<div class="trash-view">
  <div class="trash-header">
    <h2 class="trash-title"><PhTrash :size="18" /> Corbeille</h2>
    <button
      v-if="trashNotes.length > 0"
      class="btn btn-danger"
      @click="emptyTrash"
    >
      Vider la corbeille
    </button>
  </div>

  <p class="trash-retention">Les notes supprimées sont conservées pendant {{ TRASH_RETENTION_DAYS }} jours</p>

  <div v-if="trashNotes.length === 0" class="trash-empty">
    <span class="trash-empty-icon"><PhTrash :size="48" /></span>
    <p>La corbeille est vide</p>
  </div>

  <div v-else class="trash-list">
    <div class="trash-count">{{ trashNotes.length }} note{{ trashNotes.length > 1 ? 's' : '' }}</div>
    <div
      v-for="note in trashNotes"
      :key="note.id"
      class="trash-item"
    >
      <div class="trash-item-left">
        <span class="trash-item-icon"><PhIcon :name="noteIcon(note)" :size="16" /></span>
        <div class="trash-item-info">
          <span class="trash-item-title">{{ note.title || 'Sans titre' }}</span>
          <span class="trash-item-date">Supprimée {{ formatDeletedDate(note.deletedAt) }}</span>
        </div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost trash-restore-btn" @click="restoreNote(note)" title="Restaurer">
          <PhArrowCounterClockwise :size="14" /> Restaurer
        </button>
        <button class="btn btn-danger btn-sm" @click="deleteForever(note)" title="Supprimer définitivement">
          <PhX :size="14" />
        </button>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { computed } from 'vue'
import { PhTrash, PhArrowCounterClockwise, PhX } from '@phosphor-icons/vue'
import PhIcon from '../components/PhIcon.vue'
import { useBoardStore, NOTE_TYPES } from '../stores/board.js'

const store = useBoardStore()
const TRASH_RETENTION_DAYS = 30

const trashNotes = computed(() => store.trash || [])

function noteIcon(note) {
  const t = NOTE_TYPES[note.type || 'note']
  return t ? t.icon : 'file-text'
}

function formatDeletedDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "aujourd'hui"
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
</script>

<style scoped>
.trash-view {
  padding: 2rem;
  overflow-y: auto;
  height: 100%;
}

.trash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.trash-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
  margin: 0;
}

.trash-retention {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  margin-bottom: 1.5rem;
}

.trash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-muted, #64748b);
}

.trash-empty-icon {
  font-size: 3rem;
  opacity: 0.4;
  margin-bottom: 0.5rem;
}

.trash-count {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  margin-bottom: 0.75rem;
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary, #1e1e3a);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 8px;
  gap: 1rem;
}

.trash-item-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  flex: 1;
}

.trash-item-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.trash-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.trash-item-title {
  font-size: 0.9rem;
  color: var(--text-primary, #e2e8f0);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trash-item-date {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
}

.trash-item-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
  align-items: center;
}

.trash-restore-btn {
  font-size: 0.8rem;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .trash-view {
    padding: 1rem;
  }

  .trash-title {
    font-size: 1.1rem;
  }

  .trash-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .trash-item-actions {
    justify-content: flex-end;
  }
}
</style>
