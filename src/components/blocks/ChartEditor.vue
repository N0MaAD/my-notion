<template>
<Teleport to="body">
  <div v-if="visible" class="chart-editor-overlay" @click="$emit('close')">
    <div class="chart-editor" @click.stop>
      <div class="chart-editor-header">
        <h3>{{ isEditing ? 'Modifier le graphique' : 'Nouveau graphique' }}</h3>
        <button class="chart-editor-close" @click="$emit('close')">✕</button>
      </div>

      <div class="chart-editor-body">
        <label class="chart-editor-label">Titre</label>
        <input v-model="form.title" class="chart-editor-input" placeholder="Titre du graphique (optionnel)" />

        <div class="chart-editor-tabs">
          <button
            class="chart-editor-tab"
            :class="{ active: form.dataSource === 'manual' }"
            @click="form.dataSource = 'manual'"
          >Données manuelles</button>
          <button
            class="chart-editor-tab"
            :class="{ active: form.dataSource === 'auto' }"
            @click="form.dataSource = 'auto'"
          >Statistiques auto</button>
        </div>

        <div v-if="form.dataSource === 'manual'" class="chart-editor-manual">
          <div class="chart-editor-row chart-editor-row-header">
            <span>Label</span>
            <span>Valeur</span>
            <span></span>
          </div>
          <div v-for="(row, i) in form.rows" :key="i" class="chart-editor-row">
            <input v-model="row.label" placeholder="Label" class="chart-editor-input" />
            <input v-model.number="row.value" type="number" placeholder="0" class="chart-editor-input chart-editor-input-num" />
            <button class="chart-editor-row-del" @click="form.rows.splice(i, 1)" title="Supprimer">✕</button>
          </div>
          <button class="chart-editor-add-row" @click="form.rows.push({ label: '', value: 0 })">+ Ajouter une ligne</button>
        </div>

        <div v-if="form.dataSource === 'auto'" class="chart-editor-auto">
          <label class="chart-editor-label">Métrique</label>
          <select v-model="form.autoMetric" class="chart-editor-select">
            <option value="notesByColumn">Notes par colonne</option>
            <option value="notesByTag">Notes par tag</option>
            <option value="taskCompletion">Tâches terminées / en cours</option>
            <option value="notesByType">Notes par type</option>
          </select>
        </div>
      </div>

      <div class="chart-editor-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Annuler</button>
        <button class="btn btn-accent" @click="save">{{ isEditing ? 'Enregistrer' : 'Insérer' }}</button>
      </div>
    </div>
  </div>
</Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  chartType: { type: String, default: 'bar' },
  initialAttrs: { type: Object, default: null },
  isEditing: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'save'])

const form = ref({
  title: '',
  dataSource: 'manual',
  autoMetric: 'notesByColumn',
  rows: [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 15 }
  ]
})

watch(() => props.visible, (v) => {
  if (!v) return
  if (props.initialAttrs) {
    form.value.title = props.initialAttrs.title || ''
    form.value.dataSource = props.initialAttrs.dataSource || 'manual'
    form.value.autoMetric = props.initialAttrs.autoMetric || 'notesByColumn'
    if (props.initialAttrs.dataSource === 'manual' && props.initialAttrs.chartData) {
      try {
        const parsed = JSON.parse(props.initialAttrs.chartData)
        form.value.rows = (parsed.labels || []).map((l, i) => ({
          label: l,
          value: parsed.values?.[i] || 0
        }))
      } catch {
        form.value.rows = [{ label: 'A', value: 10 }, { label: 'B', value: 20 }]
      }
    }
  } else {
    form.value = {
      title: '',
      dataSource: 'manual',
      autoMetric: 'notesByColumn',
      rows: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 15 }]
    }
  }
})

function save() {
  const chartData = JSON.stringify({
    labels: form.value.rows.map(r => r.label),
    values: form.value.rows.map(r => r.value || 0)
  })
  emit('save', {
    chartType: props.chartType,
    title: form.value.title,
    dataSource: form.value.dataSource,
    autoMetric: form.value.autoMetric,
    chartData
  })
}
</script>
