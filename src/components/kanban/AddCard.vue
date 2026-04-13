<template>
<div class="add-card">
  <div v-if="isAdding" class="add-card-form">
    <div class="add-card-input-row">
      <button
        class="add-card-type-btn"
        :title="selectedTypeInfo.label"
        @click="showTypePicker = !showTypePicker"
      >
        {{ selectedTypeInfo.icon }}
      </button>
      <input
        class="input"
        v-model="title"
        @keyup.enter="submit"
        @keyup.escape="cancel"
        placeholder="Titre de la note..."
        ref="inputRef"
      />
    </div>

    <!-- Type picker dropdown -->
    <div v-if="showTypePicker" class="type-picker">
      <div
        v-for="t in types"
        :key="t.id"
        class="type-picker-item"
        :class="{ active: selectedType === t.id }"
        @click="selectType(t.id)"
      >
        <span class="type-picker-icon">{{ t.icon }}</span>
        <span class="type-picker-label">{{ t.label }}</span>
        <span class="type-picker-desc">{{ t.description }}</span>
      </div>
    </div>

    <!-- Date picker si type 'date' sélectionné -->
    <div v-if="selectedType === 'date'" class="add-card-date">
      <label class="add-card-deadline-toggle">
        <input type="checkbox" v-model="isDeadline" />
        <span>Deadline (date unique)</span>
      </label>
      <div class="add-card-deadline">
        <label>{{ isDeadline ? '📅 Date' : '🗓️ Début' }}</label>
        <input type="date" v-model="startDate" class="input" />
      </div>
      <div v-if="!isDeadline" class="add-card-deadline">
        <label>🗓️ Fin</label>
        <input type="date" v-model="endDate" class="input" />
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-accent" @click="submit">Ajouter</button>
      <button class="btn btn-ghost" @click="cancel">Annuler</button>
    </div>
  </div>

  <div v-else class="add-card-buttons">
    <button class="btn btn-ghost" @click="startAdding('note')">+ Ajouter une note</button>
    <button class="btn btn-ghost add-card-type-trigger" @click="startAddingWithPicker" title="Choisir le type">▾</button>
  </div>
</div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useBoardStore, NOTE_TYPES } from '../../stores/board.js'

const store = useBoardStore()
const props = defineProps({ columnId: String })

const isAdding = ref(false)
const title = ref('')
const inputRef = ref(null)
const selectedType = ref('note')
const showTypePicker = ref(false)
const startDate = ref('')
const endDate = ref('')
const isDeadline = ref(false)

const types = computed(() => Object.values(NOTE_TYPES).filter(t => !t.hidden))

const selectedTypeInfo = computed(() => {
  return NOTE_TYPES[selectedType.value] || NOTE_TYPES.note
})

function resetDateFields() {
  startDate.value = ''
  endDate.value = ''
  isDeadline.value = false
}

async function startAdding(type = 'note') {
  selectedType.value = type
  showTypePicker.value = false
  isAdding.value = true
  resetDateFields()
  await nextTick()
  inputRef.value?.focus()
}

async function startAddingWithPicker() {
  isAdding.value = true
  showTypePicker.value = true
  resetDateFields()
  await nextTick()
  inputRef.value?.focus()
}

function selectType(typeId) {
  selectedType.value = typeId
  showTypePicker.value = false
  inputRef.value?.focus()
}

function submit() {
  if (!title.value.trim()) return
  store.addNote(props.columnId, title.value.trim(), selectedType.value)

  // Si type 'date', appliquer les dates et le flag deadline
  if (selectedType.value === 'date') {
    const col = store.columns.find(c => c.id === props.columnId)
    if (col && col.notes.length > 0) {
      const newNote = col.notes[col.notes.length - 1]
      store.setNoteIsDeadline(newNote.id, isDeadline.value)
      store.setNoteDuration(
        newNote.id,
        startDate.value || null,
        isDeadline.value ? null : (endDate.value || null)
      )
    }
  }

  title.value = ''
  resetDateFields()
  isAdding.value = false
  showTypePicker.value = false
  selectedType.value = 'note'
}

function cancel() {
  title.value = ''
  resetDateFields()
  isAdding.value = false
  showTypePicker.value = false
  selectedType.value = 'note'
}
</script>

<style scoped>
.add-card-buttons {
  display: flex;
  gap: 0;
}

.add-card-buttons .btn:first-child {
  flex: 1;
  text-align: left;
}

.add-card-type-trigger {
  padding: 0.3rem 0.5rem !important;
  font-size: 0.75rem;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.add-card-type-trigger:hover {
  opacity: 1;
}

.add-card-input-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.add-card-input-row .input {
  flex: 1;
}

.add-card-type-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.add-card-type-btn:hover {
  background: #f0f4ff;
  border-color: #c8d8f8;
}

.type-picker {
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 0.3rem;
  margin-top: 0.3rem;
}

.type-picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: background 0.1s;
}

.type-picker-item:hover {
  background: #f0f4ff;
}

.type-picker-item.active {
  background: #f0f4ff;
  font-weight: 600;
}

.type-picker-icon {
  font-size: 0.9rem;
  width: 1.4rem;
  text-align: center;
}

.type-picker-label {
  font-weight: 500;
}

.type-picker-desc {
  color: #999;
  font-size: 0.72rem;
  margin-left: auto;
}

.add-card-date {
  margin-top: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.add-card-deadline-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.add-card-deadline-toggle input[type="checkbox"] {
  width: 0.9rem;
  height: 0.9rem;
  accent-color: #3b82f6;
  cursor: pointer;
}

.add-card-deadline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.add-card-deadline label {
  white-space: nowrap;
  color: #666;
}

.add-card-deadline .input {
  flex: 1;
  padding: 0.3rem 0.5rem;
  font-size: 0.82rem;
}
</style>
