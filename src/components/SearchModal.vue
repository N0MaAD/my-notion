<template>
<Teleport to="body">
  <div v-if="isOpen" class="search-overlay" @click.self="close">
    <div class="search-modal">
      <div class="search-input-row">
        <span class="search-icon">🔍</span>
        <input
          ref="inputRef"
          class="search-input"
          v-model="query"
          placeholder="Rechercher dans toutes les notes..."
          @keydown.escape="close"
          @keydown.down.prevent="moveDown"
          @keydown.up.prevent="moveUp"
          @keydown.enter.prevent="selectResult"
        />
        <kbd class="search-kbd">ESC</kbd>
      </div>

      <div v-if="query.length > 0" class="search-results">
        <div v-if="results.length === 0" class="search-empty">
          Aucun résultat pour "{{ query }}"
        </div>
        <div
          v-for="(result, i) in results"
          :key="result.id"
          class="search-result-item"
          :class="{ active: i === selectedIndex }"
          @click="openResult(result)"
          @mouseenter="selectedIndex = i"
        >
          <span class="search-result-icon">{{ result.type === 'note' ? '📄' : '📑' }}</span>
          <div class="search-result-text">
            <span class="search-result-title" v-html="highlight(result.title)"></span>
            <span class="search-result-path">{{ result.path }}</span>
            <span v-if="result.snippet" class="search-result-snippet" v-html="highlight(result.snippet)"></span>
          </div>
        </div>
      </div>

      <div v-else class="search-hint">
        Tapez pour rechercher dans vos notes, sous-pages et contenus
      </div>
    </div>
  </div>
</Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useBoardStore } from '../stores/board.js'

const store = useBoardStore()

const isOpen = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)

function open() {
isOpen.value = true
query.value = ''
selectedIndex.value = 0
nextTick(() => inputRef.value?.focus())
}

function close() {
isOpen.value = false
query.value = ''
}

function onKeydown(e) {
if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
  e.preventDefault()
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}
}

onMounted(() => {
document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
document.removeEventListener('keydown', onKeydown)
})

// Recherche
const results = computed(() => {
if (!query.value || query.value.length < 1) return []

const q = query.value.toLowerCase()
const found = []

for (const col of store.columns) {
  for (const note of col.notes) {
    // Chercher dans le titre de la note
    if (note.title.toLowerCase().includes(q)) {
      found.push({
        id: note.id,
        type: 'note',
        title: note.title,
        path: col.title,
        snippet: getContentSnippet(note, q),
        noteId: note.id,
        pagePath: []
      })
    } else {
      // Chercher dans le contenu texte
      const snippet = getContentSnippet(note, q)
      if (snippet) {
        found.push({
          id: note.id,
          type: 'note',
          title: note.title,
          path: col.title,
          snippet,
          noteId: note.id,
          pagePath: []
        })
      }
    }

    // Chercher dans les sous-pages
    searchSubPages(note, col.title + ' › ' + note.title, note.id, [], q, found)
  }
}

return found.slice(0, 20)
})

function searchSubPages(page, pathStr, noteId, currentPath, q, found) {
if (!page.blocks) return

for (const block of page.blocks) {
  if (block.type === 'page') {
    const blockPath = [...currentPath, block.id]

    if (block.title.toLowerCase().includes(q)) {
      found.push({
        id: block.id,
        type: 'subpage',
        title: block.title,
        path: pathStr,
        snippet: getContentSnippet(block, q),
        noteId,
        pagePath: blockPath
      })
    } else {
      const snippet = getContentSnippet(block, q)
      if (snippet) {
        found.push({
          id: block.id,
          type: 'subpage',
          title: block.title,
          path: pathStr,
          snippet,
          noteId,
          pagePath: blockPath
        })
      }
    }

    // Récursif
    searchSubPages(block, pathStr + ' › ' + block.title, noteId, blockPath, q, found)
  }
}
}

function getContentSnippet(page, q) {
if (!page.blocks) return null

const textBlock = page.blocks.find(b => b.type === 'text')
if (!textBlock || !textBlock.content) return null

// Nettoyer le HTML
const text = textBlock.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const lower = text.toLowerCase()
const idx = lower.indexOf(q)

if (idx === -1) return null

const start = Math.max(0, idx - 30)
const end = Math.min(text.length, idx + q.length + 50)
let snippet = text.slice(start, end)
if (start > 0) snippet = '...' + snippet
if (end < text.length) snippet += '...'

return snippet
}

function highlight(text) {
if (!text || !query.value) return text
const q = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
return text.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')
}

watch(query, () => {
selectedIndex.value = 0
})

function moveDown() {
if (selectedIndex.value < results.value.length - 1) {
  selectedIndex.value++
}
}

function moveUp() {
if (selectedIndex.value > 0) {
  selectedIndex.value--
}
}

function selectResult() {
if (results.value[selectedIndex.value]) {
  openResult(results.value[selectedIndex.value])
}
}

function openResult(result) {
store.activeNoteId = result.noteId
store.openPagePath = result.pagePath
close()
}
</script>