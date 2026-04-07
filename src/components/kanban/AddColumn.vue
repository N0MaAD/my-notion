<template>
<div class="add-column">
  <div v-if="isAdding" class="add-column-form">
    <input
      class="input"
      v-model="title"
      @keyup.enter="submit"
      @keyup.escape="cancel"
      placeholder="Nom de la colonne..."
      ref="inputRef"
    />
    <div class="form-actions">
      <button class="btn btn-accent" @click="submit">Ajouter</button>
      <button class="btn btn-ghost" @click="cancel">Annuler</button>
    </div>
  </div>
  <button v-else class="btn btn-ghost" @click="startAdding">+ Ajouter une colonne</button>
</div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useBoardStore } from '../../stores/board.js'

const store = useBoardStore()
const isAdding = ref(false)
const title = ref('')
const inputRef = ref(null)

async function startAdding() {
isAdding.value = true
await nextTick()
inputRef.value?.focus()
}

function submit() {
if (!title.value.trim()) return
store.addColumn(title.value.trim())
title.value = ''
isAdding.value = false
}

function cancel() {
title.value = ''
isAdding.value = false
}
</script>