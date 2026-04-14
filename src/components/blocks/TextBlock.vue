<template>
<div class="block-text" ref="blockRef">
  <!-- Toolbar flottante -->
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

  <!-- Slash menu -->
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

  <!-- Note picker (lien vers une autre note) -->
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

  <EditorContent :editor="editor" class="tiptap-editor" />
  <button class="btn btn-danger block-delete" @click="$emit('delete')">✕</button>
</div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useBoardStore } from '../../stores/board.js'
import { uploadImage } from '../../lib/uploadImage.js'

const store = useBoardStore()

const props = defineProps({ content: String })
const emit = defineEmits(['update', 'delete', 'slash-command'])

const blockRef = ref(null)
const showToolbar = ref(false)
const toolbarPos = ref({ top: 0, left: 0 })

// Slash menu
const showSlashMenu = ref(false)
const slashPos = ref({ top: 0, left: 0 })
const slashFilter = ref('')
const selectedIndex = ref(0)

const slashItems = [
{ id: 'text', icon: '📝', label: 'Texte', description: 'Bloc de texte simple', type: 'text' },
{ id: 'page', icon: '📄', label: 'Sous-page', description: 'Créer une sous-page', type: 'page' },
{ id: 'embed', icon: '🔗', label: 'Embed', description: 'Intégrer un lien (YouTube, Sheets...)', type: 'embed' },
{ id: 'noteLink', icon: '🔖', label: 'Lien vers une note', description: 'Insérer un lien vers une autre note', type: 'noteLink' },
{ id: 'image', icon: '🖼️', label: 'Image', description: 'Importer une image', type: 'image' },
{ id: 'h2', icon: 'H2', label: 'Titre 2', description: 'Grand titre', type: 'heading2' },
{ id: 'h3', icon: 'H3', label: 'Titre 3', description: 'Sous-titre', type: 'heading3' },
{ id: 'bullet', icon: '•', label: 'Liste à puces', description: 'Liste non ordonnée', type: 'bullet' },
{ id: 'ordered', icon: '1.', label: 'Liste numérotée', description: 'Liste ordonnée', type: 'ordered' },
{ id: 'quote', icon: '"', label: 'Citation', description: 'Bloc de citation', type: 'quote' },
{ id: 'code', icon: '<>', label: 'Code', description: 'Bloc de code', type: 'code' },
]

// ─── Note picker (Lien vers une note) ───
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
  // Position : sous le slash actuel
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
      marks: [
        {
          type: 'link',
          attrs: { href: `note:${note.id}`, class: 'note-link' }
        }
      ]
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

// ─── Upload image ───
async function handleImageFile(file) {
  if (!file) return
  try {
    store.addNotification('Upload de l\'image…', 'info')
    const url = await uploadImage(file)
    editor.value
      .chain()
      .focus()
      .setImage({ src: url })
      .run()
  } catch (e) {
    console.error(e)
    store.addNotification(`Échec upload image : ${e.message}`, 'archive')
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

function openSlashMenu() {
const view = editor.value.view
const { from } = editor.value.state.selection
const coords = view.coordsAtPos(from)
const blockRect = blockRef.value?.getBoundingClientRect()

if (blockRect) {
  slashPos.value = {
    top: coords.bottom - blockRect.top + 4,
    left: coords.left - blockRect.left
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
// Supprimer le "/" et le texte filtré
const { from } = editor.value.state.selection
const text = editor.value.state.doc.textBetween(0, from)
const lastSlash = text.lastIndexOf('/')
if (lastSlash !== -1) {
  editor.value.chain().focus().deleteRange({ from: lastSlash, to: from }).run()
}
}

function executeSlashCommand(item) {
deleteSlashText()
closeSlashMenu()

switch (item.type) {
  case 'text':
    // On reste juste dans l'éditeur
    break
  case 'page':
    emit('slash-command', { type: 'page' })
    break
  case 'embed':
    emit('slash-command', { type: 'embed' })
    break
  case 'noteLink':
    openNotePicker()
    break
  case 'image':
    triggerImagePicker()
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
}
}

const editor = useEditor({
content: props.content || '',
extensions: [
  StarterKit,
  Placeholder.configure({
    placeholder: 'Tapez "/" pour les commandes...'
  }),
  Link.configure({
    openOnClick: false,
    autolink: false,
    protocols: [{ scheme: 'note', optionalSlashes: true }],
    HTMLAttributes: {
      class: 'note-link',
      rel: null,
      target: null
    }
  }),
  Image.configure({
    inline: false,
    HTMLAttributes: {
      class: 'note-image'
    }
  })
],
onUpdate({ editor }) {
  emit('update', editor.getHTML())

  // Détecter le slash menu
  const { from } = editor.state.selection
  const text = editor.state.doc.textBetween(0, from)
  const lastSlash = text.lastIndexOf('/')

  if (lastSlash !== -1) {
    const afterSlash = text.slice(lastSlash + 1)
    // Vérifier qu'il n'y a pas d'espace avant le slash (ou début de ligne)
    const charBefore = lastSlash > 0 ? text[lastSlash - 1] : '\n'
    if (charBefore === '\n' || charBefore === ' ' || lastSlash === 0) {
      if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
        slashFilter.value = afterSlash
        if (!showSlashMenu.value) openSlashMenu()
        return
      }
    }
  }

  if (showSlashMenu.value) closeSlashMenu()
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
  const blockRect = blockRef.value?.getBoundingClientRect()

  if (blockRect) {
    showToolbar.value = true
    toolbarPos.value = {
      top: start.top - blockRect.top - 45,
      left: (start.left + end.left) / 2 - blockRect.left - 100
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

watch(() => props.content, (val) => {
if (editor.value && val !== editor.value.getHTML()) {
  editor.value.commands.setContent(val || '')
}
})

onBeforeUnmount(() => {
editor.value?.destroy()
})
</script>