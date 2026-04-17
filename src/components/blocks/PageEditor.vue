<template>
<div class="page-editor" ref="editorRef" @click="focusEditor" @dragover.prevent>
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

    <!-- Note picker -->
    <div
      v-if="showNotePicker"
      class="note-picker"
      :style="{ top: notePickerPos.top + 'px', left: notePickerPos.left + 'px' }"
    >
      <input
        ref="notePickerInputRef"
        v-model="notePickerFilter"
        class="note-picker-input"
        placeholder="Rechercher une note..."
        @keydown="onNotePickerKey"
        @blur="closeNotePicker"
      />
      <div class="note-picker-list">
        <div
          v-for="(n, i) in filteredNotes"
          :key="n.id"
          class="note-picker-item"
          :class="{ active: i === notePickerIndex }"
          @mousedown.prevent="pickNote(n)"
          @mouseenter="notePickerIndex = i"
        >
          <span class="note-picker-item-title">🔖 {{ n.title }}</span>
          <span class="note-picker-item-col">{{ n.columnTitle }}</span>
        </div>
        <div v-if="filteredNotes.length === 0" class="note-picker-empty">
          Aucune note
        </div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onImageFileChange"
    />

    <EditorContent :editor="editor" class="tiptap-editor tiptap-fullpage" />
  </div>
</div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted, watch, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { PageNode, setOpenSubPageCallback } from '../../extensions/PageNode.js'
import { EmbedNode } from '../../extensions/EmbedNode.js'
import { useBoardStore } from '../../stores/board.js'
import { DragHandle } from '../../extensions/DragHandle.js'
import { uploadImage } from '../../lib/uploadImage.js'

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
{ id: 'noteLink', icon: '🔖', label: 'Lien vers une note', description: 'Insérer un lien vers une autre note', type: 'noteLink' },
{ id: 'image', icon: '🖼️', label: 'Image', description: 'Importer une image', type: 'image' },
{ id: 'page', icon: '📄', label: 'Sous-page', description: 'Créer une sous-page', type: 'page' },
{ id: 'embed', icon: '🔗', label: 'Embed', description: 'Intégrer un lien (YouTube, Sheets...)', type: 'embed' },
]

// ─── Note picker ───
const showNotePicker = ref(false)
const notePickerPos = ref({ top: 0, left: 0 })
const notePickerFilter = ref('')
const notePickerIndex = ref(0)
const notePickerInputRef = ref(null)
const fileInputRef = ref(null)

const allNotes = computed(() => {
  const result = []
  for (const col of store.columns) {
    for (const note of col.notes) {
      result.push({ id: note.id, title: note.title || 'Sans titre', columnTitle: col.title })
    }
  }
  return result
})

const filteredNotes = computed(() => {
  const q = notePickerFilter.value.trim().toLowerCase()
  const list = q
    ? allNotes.value.filter(n => n.title.toLowerCase().includes(q))
    : allNotes.value
  return list.slice(0, 12)
})

async function openNotePicker() {
  notePickerPos.value = { ...slashPos.value }
  notePickerFilter.value = ''
  notePickerIndex.value = 0
  showNotePicker.value = true
  await nextTick()
  notePickerInputRef.value?.focus()
}

function closeNotePicker() {
  showNotePicker.value = false
  notePickerFilter.value = ''
  notePickerIndex.value = 0
  editor.value?.commands.focus()
}

function pickNote(note) {
  if (!note) return
  editor.value
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text: note.title,
      marks: [{ type: 'link', attrs: { href: `note:${note.id}`, class: 'note-link' } }]
    })
    .insertContent(' ')
    .run()
  closeNotePicker()
}

function onNotePickerKey(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    notePickerIndex.value = Math.min(notePickerIndex.value + 1, filteredNotes.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    notePickerIndex.value = Math.max(notePickerIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pickNote(filteredNotes.value[notePickerIndex.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeNotePicker()
  }
}

// ─── Image handling ───
async function handleImageFile(file) {
  if (!file) return
  try {
    store.addNotification('Compression de l\'image…', 'info')
    const dataUrl = await uploadImage(file)
    editor.value
      .chain()
      .focus()
      .setImage({ src: dataUrl })
      .run()
  } catch (e) {
    console.error(e)
    store.addNotification(`Échec image : ${e.message}`, 'archive')
  }
}

function triggerImagePicker() {
  fileInputRef.value?.click()
}

function onImageFileChange(e) {
  const file = e.target.files?.[0]
  if (file) handleImageFile(file)
  e.target.value = ''
}

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

function focusEditor(event) {
  if (event.target === editorRef.value && editor.value) {
    editor.value.commands.focus('end')
  }
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
  case 'noteLink':
    openNotePicker()
    break
  case 'image':
    triggerImagePicker()
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
  Link.configure({
    openOnClick: false,
    autolink: false,
    protocols: [{ scheme: 'note', optionalSlashes: true }],
    HTMLAttributes: { class: 'note-link', rel: null, target: null }
  }),
  Image.configure({
    inline: false,
    HTMLAttributes: { class: 'note-image' }
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
  handleClickOn(view, pos, node, nodePos, event) {
    const a = event.target.closest && event.target.closest('a')
    if (a && a.getAttribute('href')?.startsWith('note:')) {
      event.preventDefault()
      const noteId = a.getAttribute('href').replace(/^note:\/?\/?/, '')
      store.setActiveNote(noteId)
      return true
    }
    return false
  },
  handleDrop(view, event, slice, moved) {
    if (moved) return false
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return false
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return false
    event.preventDefault()
    imageFiles.forEach((f) => handleImageFile(f))
    return true
  },
  handlePaste(view, event) {
    const items = event.clipboardData?.items
    if (!items) return false
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile()
        if (file) {
          event.preventDefault()
          handleImageFile(file)
          return true
        }
      }
    }
    return false
  },
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