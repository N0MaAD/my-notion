<template>
<Teleport to="body">
  <div v-if="visible" class="agenda-modal-overlay" @click="$emit('close')">
    <div class="agenda-modal" @click.stop>
      <div class="agenda-modal-header">
        <h3>{{ editing ? 'Modifier l\'événement' : 'Nouvel événement' }}</h3>
        <button class="agenda-modal-close" @click="$emit('close')"><PhX :size="18" /></button>
      </div>

      <div class="agenda-modal-body">
        <label class="agenda-modal-label">Titre</label>
        <input
          v-model="form.title"
          type="text"
          class="agenda-modal-input"
          placeholder="Titre de l'événement..."
          @keyup.enter="submit"
          ref="titleInputRef"
        />

        <label class="agenda-modal-checkbox">
          <input type="checkbox" v-model="form.isDeadline" />
          <span>Deadline (date unique)</span>
        </label>

        <label class="agenda-modal-label">{{ form.isDeadline ? 'Date' : 'Début' }}</label>
        <input v-model="form.startDate" type="date" class="agenda-modal-input" />

        <template v-if="!form.isDeadline">
          <label class="agenda-modal-label">Fin</label>
          <input v-model="form.endDate" type="date" class="agenda-modal-input" />
        </template>

        <label class="agenda-modal-checkbox">
          <input type="checkbox" v-model="form.hasTime" />
          <span>Définir une heure (rappel)</span>
        </label>

        <input
          v-if="form.hasTime"
          v-model="form.startTime"
          type="time"
          class="agenda-modal-input"
        />

        <label class="agenda-modal-label">Couleur</label>
        <div class="agenda-modal-colors">
          <button
            v-for="c in colorPalette"
            :key="c.value || 'none'"
            class="agenda-color-swatch"
            :class="{ active: form.color === c.value }"
            :style="{ background: c.value || 'transparent', borderColor: c.value || '#999' }"
            :title="c.label"
            @click="form.color = c.value"
          >
            <span v-if="!c.value">∅</span>
          </button>
        </div>
      </div>

      <div class="agenda-modal-footer">
        <button v-if="editing" class="btn btn-danger" @click="$emit('delete')">Supprimer</button>
        <span class="agenda-modal-spacer"></span>
        <button class="btn btn-ghost" @click="$emit('close')">Annuler</button>
        <button class="btn btn-accent" @click="submit">{{ editing ? 'Enregistrer' : 'Créer' }}</button>
      </div>
    </div>
  </div>
</Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { PhX } from '@phosphor-icons/vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
  initialData: { type: Object, default: null }
})

const emit = defineEmits(['close', 'save', 'delete'])

const titleInputRef = ref(null)

const colorPalette = [
  { value: null, label: 'Défaut' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Rouge' },
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#14b8a6', label: 'Turquoise' },
  { value: '#a855f7', label: 'Violet' },
  { value: '#22c55e', label: 'Vert' },
  { value: '#ec4899', label: 'Rose' }
]

const form = ref(defaultForm())

function defaultForm() {
  return {
    title: '',
    isDeadline: true,
    startDate: '',
    endDate: '',
    hasTime: false,
    startTime: '09:00',
    color: null
  }
}

watch(() => props.visible, async (v) => {
  if (!v) return
  if (props.initialData) {
    form.value = {
      title: props.initialData.title || '',
      isDeadline: props.initialData.isDeadline !== false,
      startDate: props.initialData.startDate ? props.initialData.startDate.slice(0, 10) : '',
      endDate: props.initialData.endDate ? props.initialData.endDate.slice(0, 10) : '',
      hasTime: !!props.initialData.startTime,
      startTime: props.initialData.startTime || '09:00',
      color: props.initialData.customColor || props.initialData.color || null
    }
  } else {
    form.value = defaultForm()
  }
  await nextTick()
  titleInputRef.value?.focus()
})

function submit() {
  if (!form.value.title.trim()) return
  emit('save', {
    title: form.value.title.trim(),
    isDeadline: form.value.isDeadline,
    startDate: form.value.startDate || null,
    endDate: form.value.isDeadline ? null : (form.value.endDate || null),
    startTime: form.value.hasTime ? form.value.startTime : null,
    color: form.value.color
  })
}
</script>
