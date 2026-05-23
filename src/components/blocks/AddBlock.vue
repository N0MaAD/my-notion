<template>
<div class="add-block">
  <div v-if="isOpen" class="add-block-menu">
    <button class="btn btn-ghost add-block-option" @click="add('text')">
      <PhNotePencil :size="16" /> Texte
    </button>
    <button class="btn btn-ghost add-block-option" @click="addPage">
      <PhFilePlus :size="16" /> Sous-page
    </button>
    <button class="btn btn-ghost add-block-option" @click="addEmbed">
      <PhLinkSimple :size="16" /> Embed
    </button>
  </div>
  <button v-else class="btn btn-ghost" @click="isOpen = true">
    + Ajouter un bloc
  </button>
</div>
</template>

<script setup>
import { ref } from 'vue'
import { PhNotePencil, PhFilePlus, PhLinkSimple } from '@phosphor-icons/vue'
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