<template>
<div class="color-picker-wrapper">
  <button
    class="color-dot"
    :style="{ backgroundColor: currentColor }"
    @click.stop="isOpen = !isOpen"
  />
  <div v-if="isOpen" class="color-picker-popup" @click.stop>
    <div class="color-presets">
      <button
        v-for="c in presets"
        :key="c"
        class="color-preset"
        :class="{ active: c === color }"
        :style="{ backgroundColor: c }"
        @click="selectColor(c)"
      />
    </div>

    <div class="color-picker-section">
      <label class="color-picker-label">Couleur</label>
      <div class="color-input-row">
        <input
          type="color"
          :value="color"
          @input="selectColor($event.target.value)"
          class="color-native-input"
        />
        <input
          type="text"
          :value="color"
          @change="onHexInput($event.target.value)"
          class="input color-hex-input"
          placeholder="#000000"
          maxlength="7"
        />
      </div>
    </div>

    <div class="color-picker-section">
      <label class="color-picker-label">Opacité: {{ Math.round(opacity * 100) }}%</label>
      <input
        type="range"
        min="0"
        max="100"
        :value="Math.round(opacity * 100)"
        @input="onOpacityChange($event.target.value)"
        class="color-opacity-slider"
      />
    </div>

    <div class="color-preview-row">
      <div class="color-preview" :style="{ backgroundColor: currentColor }" />
      <button class="btn btn-ghost" @click="selectColor(null)">Reset</button>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
color: { type: String, default: null },
opacity: { type: Number, default: 1 }
})

const emit = defineEmits(['update:color', 'update:opacity'])

const isOpen = ref(false)

const presets = [
'#ef4444', '#f97316', '#eab308', '#22c55e',
'#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
'#64748b', '#1e293b'
]

const currentColor = computed(() => {
if (!props.color) return 'var(--bg-secondary)'
const r = parseInt(props.color.slice(1, 3), 16)
const g = parseInt(props.color.slice(3, 5), 16)
const b = parseInt(props.color.slice(5, 7), 16)
return `rgba(${r}, ${g}, ${b}, ${props.opacity})`
})

function selectColor(c) {
emit('update:color', c)
}

function onHexInput(val) {
val = val.trim()
if (!val.startsWith('#')) val = '#' + val
if (/^#[0-9a-fA-F]{6}$/.test(val)) {
  emit('update:color', val)
}
}

function onOpacityChange(val) {
emit('update:opacity', parseInt(val) / 100)
}

function closeOnOutside(e) {
if (isOpen.value) {
  isOpen.value = false
}
}

onMounted(() => {
document.addEventListener('click', closeOnOutside)
})

onBeforeUnmount(() => {
document.removeEventListener('click', closeOnOutside)
})
</script>