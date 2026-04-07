<template>
<div class="add-block">
  <div v-if="isOpen" class="add-block-menu">
    <button class="btn btn-ghost add-block-option" @click="add('text')">
      📝 Texte
    </button>
    <button class="btn btn-ghost add-block-option" @click="addPage">
      📄 Sous-page
    </button>
    <button class="btn btn-ghost add-block-option" @click="addEmbed">
      🔗 Embed
    </button>
  </div>
  <button v-else class="btn btn-ghost" @click="isOpen = true">
    + Ajouter un bloc
  </button>
</div>
</template>

<script setup>
import { ref } from 'vue'
import { useBoardStore } from '../../stores/board.js'

const store = useBoardStore()
const isOpen = ref(false)

function add(type) {
store.addBlock(type)
isOpen.value = false
}

function addPage() {
const title = prompt('Nom de la sous-page :')
if (title && title.trim()) {
  store.addBlock('page', { title: title.trim() })
}
isOpen.value = false
}

function addEmbed() {
const url = prompt('URL à intégrer (Google Sheets, etc.) :')
if (url && url.trim()) {
  const label = prompt('Label (optionnel) :') || url
  store.addBlock('embed', { url: url.trim(), label: label.trim() })
}
isOpen.value = false
}
</script>