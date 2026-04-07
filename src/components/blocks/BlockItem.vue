<template>
<div class="block-item">
  <TextBlock
    v-if="block.type === 'text'"
    :content="block.content"
    @update="store.updateBlock(block.id, { content: $event })"
    @delete="store.deleteBlock(block.id)"
    @slash-command="handleSlashCommand"
  />

  <div v-else-if="block.type === 'page'" class="block-page" @click="store.openSubPage(block.id)">
    <span class="block-page-icon">📄</span>
    <span class="block-page-title">{{ block.title }}</span>
    <span class="block-page-arrow">›</span>
    <button class="btn btn-danger block-delete" @click.stop="store.deleteBlock(block.id)">✕</button>
  </div>

  <div v-else-if="block.type === 'embed'" class="block-embed">
    <div class="block-embed-header">
      <span>🔗 {{ block.label || block.url }}</span>
      <button class="btn btn-danger block-delete block-delete-embed" @click="store.deleteBlock(block.id)">✕</button>
    </div>
    <div
      class="block-embed-wrapper"
      :style="{ width: embedWidth + 'px', height: embedHeight + 'px' }"
    >
      <iframe
        :src="block.url"
        class="block-embed-frame"
        frameborder="0"
        allowfullscreen
      />
      <div class="embed-resize-handle" @mousedown.prevent="startEmbedResize" />
    </div>
  </div>
</div>
</template>

<script setup>
import { ref } from 'vue'
import { useBoardStore } from '../../stores/board.js'
import TextBlock from './TextBlock.vue'

const store = useBoardStore()
defineProps({ block: Object })

const embedWidth = ref(null)
const embedHeight = ref(300)

function handleSlashCommand(command) {
if (command.type === 'page') {
  const title = prompt('Nom de la sous-page :')
  if (title && title.trim()) {
    store.addBlock('page', { title: title.trim() })
  }
} else if (command.type === 'embed') {
  const url = prompt('URL à intégrer (YouTube, Sheets...) :')
  if (url && url.trim()) {
    const label = prompt('Label (optionnel) :') || url
    store.addBlock('embed', { url: url.trim(), label: label.trim() })
  }
}
}

function startEmbedResize(e) {
const startX = e.clientX
const startY = e.clientY
const startWidth = embedWidth.value || e.target.closest('.block-embed-wrapper').offsetWidth
const startHeight = embedHeight.value

if (!embedWidth.value) embedWidth.value = startWidth

function onMouseMove(e) {
  embedWidth.value = Math.max(200, startWidth + (e.clientX - startX))
  embedHeight.value = Math.max(150, startHeight + (e.clientY - startY))
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

document.body.style.cursor = 'nwse-resize'
document.body.style.userSelect = 'none'
document.addEventListener('mousemove', onMouseMove)
document.addEventListener('mouseup', onMouseUp)
}
</script>