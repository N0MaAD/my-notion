import { Node, mergeAttributes } from '@tiptap/core'
import { createIcon } from '../utils/icons.js'

let onOpenSubPage = null

export function setOpenSubPageCallback(fn) {
  onOpenSubPage = fn
}

export const PageNode = Node.create({
  name: 'pageBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      pageId: { default: null },
      title: { default: 'Sans titre' }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-page-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-page-block': '',
      'class': 'node-page-block'
    }), HTMLAttributes.title]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.classList.add('node-page-block')
      dom.contentEditable = 'false'

      const icon = document.createElement('span')
      icon.classList.add('node-page-icon')
      icon.appendChild(createIcon('file-text', 14))

      const title = document.createElement('span')
      title.classList.add('node-page-title')
      title.textContent = node.attrs.title

      const arrow = document.createElement('span')
      arrow.classList.add('node-page-arrow')
      arrow.appendChild(createIcon('caret-right', 10))

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
      dom.appendChild(arrow)
      dom.appendChild(deleteBtn)

      dom.addEventListener('click', () => {
        if (onOpenSubPage) {
          onOpenSubPage(node.attrs.pageId)
        }
      })

      return { dom }
    }
  }
})