import { Node, mergeAttributes } from '@tiptap/core'
import { createIcon } from '../utils/icons.js'

export const DateNode = Node.create({
  name: 'dateBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      noteId: { default: null },
      title: { default: '' },
      date: { default: '' },
      endDate: { default: null },
      isDeadline: { default: true }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-date-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const label = HTMLAttributes.isDeadline
      ? HTMLAttributes.date
      : `${HTMLAttributes.date || '?'} → ${HTMLAttributes.endDate || '?'}`
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-date-block': '',
      'class': 'node-date-block'
    }), `${HTMLAttributes.title} — ${label}`]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.classList.add('node-date-block')
      dom.contentEditable = 'false'

      const icon = document.createElement('span')
      icon.classList.add('node-date-icon')
      icon.appendChild(createIcon(node.attrs.isDeadline ? 'calendar-dot' : 'calendar-blank', 14))

      const title = document.createElement('span')
      title.classList.add('node-date-title')
      title.textContent = node.attrs.title || 'Événement'

      const dateEl = document.createElement('span')
      dateEl.classList.add('node-date-value')
      dateEl.textContent = formatDateDisplay(node.attrs)

      const deleteBtn = document.createElement('button')
      deleteBtn.classList.add('node-delete-btn')
      deleteBtn.appendChild(createIcon('x', 12))
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const pos = getPos()
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
      })

      dom.appendChild(icon)
      dom.appendChild(title)
      dom.appendChild(dateEl)
      dom.appendChild(deleteBtn)

      return { dom }
    }
  }
})

function formatDateDisplay(attrs) {
  const fmt = (d) => {
    if (!d) return '?'
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }
  if (attrs.isDeadline) return fmt(attrs.date)
  return `${fmt(attrs.date)} → ${fmt(attrs.endDate)}`
}
