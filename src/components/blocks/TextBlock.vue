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

  <EditorContent :editor="editor" class="tiptap-editor" />
  <button class="btn btn-danger block-delete" @click="$emit('delete')">✕</button>
</div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

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
{ id: 'h2', icon: 'H2', label: 'Titre 2', description: 'Grand titre', type: 'heading2' },
{ id: 'h3', icon: 'H3', label: 'Titre 3', description: 'Sous-titre', type: 'heading3' },
{ id: 'bullet', icon: '•', label: 'Liste à puces', description: 'Liste non ordonnée', type: 'bullet' },
{ id: 'ordered', icon: '1.', label: 'Liste numérotée', description: 'Liste ordonnée', type: 'ordered' },
{ id: 'quote', icon: '"', label: 'Citation', description: 'Bloc de citation', type: 'quote' },
{ id: 'code', icon: '<>', label: 'Code', description: 'Bloc de code', type: 'code' },
]

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