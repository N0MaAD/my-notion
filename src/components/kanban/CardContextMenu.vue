<template>
<Teleport to="body">
  <div
    v-if="visible"
    class="context-overlay"
    @click="close"
    @contextmenu.prevent="close"
  />
  <div
    v-if="visible"
    class="context-menu"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <div class="context-menu-label">Changer le type</div>
    <div
      v-for="t in types"
      :key="t.id"
      class="context-menu-item"
      :class="{ active: t.id === currentType }"
      @click="selectType(t.id)"
    >
      <span class="context-menu-icon">{{ t.icon }}</span>
      <span class="context-menu-text">{{ t.label }}</span>
      <span v-if="t.id === currentType" class="context-menu-check">✓</span>
    </div>

    <div v-if="currentType === 'date'" class="context-menu-divider" />
    <div v-if="currentType === 'date'" class="context-menu-date">
      <label class="context-menu-checkbox-label">
        <input
          type="checkbox"
          :checked="currentIsDeadline"
          @change="toggleDeadline($event.target.checked)"
        />
        <span>Deadline (date unique)</span>
      </label>

      <label class="context-menu-date-label">
        {{ currentIsDeadline ? '📅 Date' : '🗓️ Date de debut' }}
      </label>
      <input
        type="date"
        class="context-menu-date-input"
        :value="localStart"
        @input="localStart = $event.target.value; applyDates()"
      />

      <template v-if="!currentIsDeadline">
        <label class="context-menu-date-label" style="margin-top: 0.5rem">🗓️ Date de fin</label>
        <input
          type="date"
          class="context-menu-date-input"
          :value="localEnd"
          @input="localEnd = $event.target.value; applyDates()"
        />
      </template>
    </div>
  </div>
</Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { NOTE_TYPES, useBoardStore } from '../../stores/board.js'

const store = useBoardStore()

const props = defineProps({
  visible: Boolean,
  x: Number,
  y: Number,
  noteId: String,
  currentType: { type: String, default: 'note' },
  currentStartDate: { type: String, default: null },
  currentEndDate: { type: String, default: null },
  currentIsDeadline: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

// Types visibles (on exclut les anciens types migres caches)
const types = computed(() => Object.values(NOTE_TYPES).filter(t => !t.hidden))

const localStart = ref(props.currentStartDate || '')
const localEnd = ref(props.currentEndDate || '')

watch(() => [props.currentStartDate, props.currentEndDate], ([s, e]) => {
  localStart.value = s || ''
  localEnd.value = e || ''
})

function selectType(typeId) {
  store.updateNoteType(props.noteId, typeId)
  if (typeId !== 'date') {
    close()
  }
}

function applyDates() {
  store.setNoteDuration(
    props.noteId,
    localStart.value || null,
    localEnd.value || null
  )
}

function toggleDeadline(checked) {
  store.setNoteIsDeadline(props.noteId, checked)
  if (checked) {
    localEnd.value = ''
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.context-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  min-width: 200px;
  padding: 0.4rem;
  animation: contextIn 0.12s ease-out;
}

@keyframes contextIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #999;
  padding: 0.4rem 0.6rem 0.3rem;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: #f0f4ff;
}

.context-menu-item.active {
  background: #f0f4ff;
  font-weight: 600;
}

.context-menu-icon {
  font-size: 0.95rem;
  width: 1.4rem;
  text-align: center;
}

.context-menu-text {
  flex: 1;
}

.context-menu-check {
  color: #3b82f6;
  font-size: 0.8rem;
}

.context-menu-divider {
  height: 1px;
  background: #eee;
  margin: 0.3rem 0.4rem;
}

.context-menu-date {
  padding: 0.4rem 0.6rem;
}

.context-menu-date-label {
  font-size: 0.75rem;
  color: #666;
  display: block;
  margin-bottom: 0.3rem;
}

.context-menu-date-input {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
}

.context-menu-date-input:focus {
  border-color: #3b82f6;
}

.context-menu-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: #444;
  margin-bottom: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.context-menu-checkbox-label input[type="checkbox"] {
  width: 0.9rem;
  height: 0.9rem;
  accent-color: #3b82f6;
  cursor: pointer;
}
</style>
