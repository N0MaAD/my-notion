<template>
<div class="page-editor" ref="editorRef" @click="focusEditor">
  <div class="editor-area" ref="blockRef">
    <div
      v-if="showToolbar"
      class="bubble-menu"
      :style="{ top: toolbarPos.top + 'px', left: toolbarPos.left + 'px' }"
    >
      <button class="bubble-btn" :class="{ active: editor?.isActive('bold') }" @mousedown.prevent="editor?.chain().focus().toggleBold().run()">B</button>
      <button class="bubble-btn" :class="{ active: editor?.isActive('italic') }" @mousedown.prevent="editor?.chain().focus().toggleItalic().run()">I</button>
      <button class="bubble-btn" :class="{ active: editor?.isActive('strike') }" @mousedown.prevent="editor?.chain().focus().toggleStrike().run()">S̶</button>
      <button class="bubble-btn" :class="{ active: editor?.isActive('code') }" @mousedown.prevent="editor?.chain().focus().toggleCode().run()">&lt;/&gt;</button>
      <span class="bubble-sep" />
      <button class="bubble-btn" :class="{ active: editor?.isActive('heading', { level: 2 }) }" @mousedown.prevent="editor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button class="bubble-btn" :class="{ active: editor?.isActive('heading', { level: 3 }) }" @mousedown.prevent="editor?.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
      <span class="bubble-sep" />
      <button class="bubble-btn" :class="{ active: editor?.isActive('bulletList') }" @mousedown.prevent="editor?.chain().focus().toggleBulletList().run()">•</button>
      <button class="bubble-btn" :class="{ active: editor?.isActive('orderedList') }" @mousedown.prevent="editor?.chain().focus().toggleOrderedList().run()">1.</button>
      <button class="bubble-btn" :class="{ active: editor?.isActive('blockquote') }" @mousedown.prevent="editor?.chain().focus().toggleBlockquote().run()">"</button>
    </div>

    <div
      v-if="showSlashMenu"
      class="slash-menu"
      :style="{ top: slashPos.top + 'px', left: slashPos.left + 'px' }"
    >
      <div
        v-for="(item, i) in filteredSlashItems"
        :key="item.id"
        class="slash-menu-item"
        :class="{ active: i === selectedIndex }"
        @mousedown.prevent="executeSlashCommand(item)"
        @mouseenter="selectedIndex = i"
      >
        <span class="slash-menu-icon">{{ item.icon }}</span>
        <div class="slash-menu-text">
          <span class="slash-menu-label">{{ item.label }}</span>
          <span class="slash-menu-desc">{{ item.description }}</span>
        </div>
      </div>
      <div v-if="filteredSlashItems.length === 0" class="slash-menu-empty">
        Aucun résultat
      </div>
    </div>

    <EditorContent :editor="editor" class="tiptap-editor tiptap-fullpage" />
  </div>
</div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { PageNode, setOpenSubPageCallback } from '../../extensions/PageNode.js'
import { EmbedNode } from '../../extensions/EmbedNode.js'
import { useBoardStore } from '../../stores/board.js'
import { DragHandle } from '../../extensions/DragHandle.js'

const store = useBoardStore()

const editorRef = ref(null)
const blockRef = ref(null)
const showToolbar = ref(false)
const toolbarPos = ref({ top: 0, left: 0 })
const showSlashMenu = ref(false)
const slashPos = ref({ top: 0, left: 0 })
const slashFilter = ref('')
const selectedIndex = ref(0)

const slashItems = [
{ id: 'h1', icon: 'H1', label: 'Titre 1', description: 'Grand titre', type: 'heading1' },
{ id: 'h2', icon: 'H2', label: 'Titre 2', description: 'Titre moyen', type: 'heading2' },
{ id: 'h3', icon: 'H3', label: 'Titre 3', description: 'Petit titre', type: 'heading3' },
{ id: 'bullet', icon: '•', label: 'Liste à puces', description: 'Liste non ordonnée', type: 'bullet' },
{ id: 'ordered', icon: '1.', label: 'Liste numérotée', description: 'Liste ordonnée', type: 'ordered' },
{ id: 'quote', icon: '"', label: 'Citation', description: 'Bloc de citation', type: 'quote' },
{ id: 'code', icon: '<>', label: 'Code', description: 'Bloc de code', type: 'code' },
{ id: 'page', icon: '📄', label: 'Sous-page', description: 'Créer une sous-page', type: 'page' },
{ id: 'embed', icon: '🔗', label: 'Embed', description: 'Intégrer un lien (YouTube, Sheets...)', type: 'embed' },
]

const filteredSlashItems = computed(() => {
if (!slashFilter.value) return slashItems
const filter = slashFilter.value.toLowerCase()
return slashItems.filter(item =>
  item.label.toLowerCase().includes(filter) ||
  item.description.toLowerCase().includes(filter)
)
})

watch(filteredSlashItems, () => {
selectedIndex.value = 0
})

function focusEditor() {
if (editor.value) editor.value.commands.focus('end')
}

function openSlashMenu() {
const view = editor.value.view
const { from } = editor.value.state.selection
const coords = view.coordsAtPos(from)
const rect = blockRef.value?.getBoundingClientRect()

if (rect) {
  slashPos.value = {
    top: coords.bottom - rect.top + 4,
    left: coords.left - rect.left
  }
}
showSlashMenu.value = true
slashFilter.value = ''
selectedIndex.value = 0
}

function closeSlashMenu() {
showSlashMenu.value = false
slashFilter.value = ''
selectedIndex.value = 0
}

function deleteSlashText() {
const { $from } = editor.value.state.selection
const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
const slashMatch = textBefore.match(/\/([^\s]*)$/)
if (slashMatch) {
  const from = editor.value.state.selection.from - slashMatch[0].length
  const to = editor.value.state.selection.from
  editor.value.chain().focus().deleteRange({ from, to }).run()
}
}

function toEmbedUrl(url) {
const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`

const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
if (sheetsMatch) {
  const gidMatch = url.match(/gid=(\d+)/)
  const gid = gidMatch ? `#gid=${gidMatch[1]}` : ''
  return `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview${gid}`
}

const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
if (docsMatch) return `https://docs.google.com/document/d/${docsMatch[1]}/preview`

const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/)
if (slidesMatch) return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed`

const formsMatch = url.match(/docs\.google\.com\/forms\/d\/([a-zA-Z0-9_-]+)/)
if (formsMatch) return `https://docs.google.com/forms/d/${formsMatch[1]}/viewform?embedded=true`

return url
}

function executeSlashCommand(item) {
deleteSlashText()
closeSlashMenu()

switch (item.type) {
  case 'heading1':
    editor.value.chain().focus().toggleHeading({ level: 1 }).run()
    break
  case 'heading2':
    editor.value.chain().focus().toggleHeading({ level: 2 }).run()
    break
  case 'heading3':
    editor.value.chain().focus().toggleHeading({ level: 3 }).run()
    break
  case 'bullet':
    editor.value.chain().focus().toggleBulletList().run()
    break
  case 'ordered':
    editor.value.chain().focus().toggleOrderedList().run()
    break
  case 'quote':
    editor.value.chain().focus().toggleBlockquote().run()
    break
  case 'code':
    editor.value.chain().focus().toggleCodeBlock().run()
    break
  case 'page': {
    const title = prompt('Nom de la sous-page :')
    if (title && title.trim()) {
      store.addBlock('page', { title: title.trim() })
      const page = store.currentPage
      const newBlock = page.blocks[page.blocks.length - 1]
      editor.value.chain().focus().insertContent({
        type: 'pageBlock',
        attrs: { pageId: newBlock.id, title: title.trim() }
      }).run()
    }
    break
  }
  case 'embed': {
    const url = prompt('URL à intégrer (YouTube, Sheets...) :')
    if (url && url.trim()) {
      const label = prompt('Label (optionnel) :') || url
      const embedUrl = toEmbedUrl(url.trim())
      editor.value.chain().focus().insertContent({
        type: 'embedBlock',
        attrs: { url: embedUrl, label: label.trim() }
      }).run()
    }
    break
  }
}
}

function getInitialContent() {
if (!store.currentPage) return ''
const tb = store.currentPage.blocks.find(b => b.type === 'text')
return tb ? tb.content || '' : ''
}

const editor = useEditor({
content: getInitialContent(),
extensions: [
  StarterKit,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') return 'Titre...'
      return "Tapez '/' pour les commandes..."
    },
    includeChildren: false,
    showOnlyCurrent: true,
    showOnlyWhenEditable: true
  }),
  PageNode,
  EmbedNode,
  DragHandle
],
onUpdate({ editor }) {
  const page = store.currentPage
  if (!page) return
  const tb = page.blocks.find(b => b.type === 'text')
  if (tb) {
    tb.content = editor.getHTML()
  } else {
    store.addBlock('text', { content: editor.getHTML() })
  }

  const { $from } = editor.state.selection
  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
  const slashMatch = textBefore.match(/\/([^\s]*)$/)

  if (slashMatch) {
    slashFilter.value = slashMatch[1]
    if (!showSlashMenu.value) openSlashMenu()
  } else if (showSlashMenu.value) {
    closeSlashMenu()
  }
},
onSelectionUpdate({ editor }) {
  const { from, to } = editor.state.selection
  if (from === to) {
    showToolbar.value = false
    return
  }
  const view = editor.view
  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  const rect = blockRef.value?.getBoundingClientRect()
  if (rect) {
    showToolbar.value = true
    toolbarPos.value = {
      top: start.top - rect.top - 45,
      left: (start.left + end.left) / 2 - rect.left - 100
    }
  }
},
editorProps: {
  handleKeyDown(view, event) {
    if (!showSlashMenu.value) return false
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, filteredSlashItems.value.length - 1)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredSlashItems.value[selectedIndex.value]) {
        executeSlashCommand(filteredSlashItems.value[selectedIndex.value])
      }
      return true
    }
    if (event.key === 'Escape') {
      closeSlashMenu()
      return true
    }
    return false
  }
}
})

onMounted(() => {
setOpenSubPageCallback((pageId) => {
  store.openSubPage(pageId)
})
})

onBeforeUnmount(() => {
setOpenSubPageCallback(null)
editor.value?.destroy()
})

watch(() => store.currentPage, (page) => {
if (editor.value && page) {
  const tb = page.blocks.find(b => b.type === 'text')
  const content = tb ? tb.content || '' : ''
  if (content !== editor.value.getHTML()) {
    editor.value.commands.setContent(content)
  }
}
}, { immediate: true })
</script>