import { Node, mergeAttributes } from '@tiptap/core'
import { createIcon } from '../utils/icons.js'

export const CalloutNode = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: { default: 'lightbulb' }
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-callout]',
      getAttrs: el => ({ emoji: el.getAttribute('data-emoji') || 'lightbulb' })
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-callout': '',
      'data-emoji': node.attrs.emoji,
      class: 'callout-block'
    }),
      ['span', { class: 'callout-icon', contenteditable: 'false' }, node.attrs.emoji],
      ['div', { class: 'callout-content' }, 0]
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'callout-block'
      dom.setAttribute('data-callout', '')
      dom.setAttribute('data-emoji', node.attrs.emoji)

      const iconEl = document.createElement('span')
      iconEl.className = 'callout-icon'
      iconEl.contentEditable = 'false'
      iconEl.appendChild(createIcon('lightbulb', 18))

      const contentEl = document.createElement('div')
      contentEl.className = 'callout-content'

      dom.appendChild(iconEl)
      dom.appendChild(contentEl)

      return { dom, contentDOM: contentEl }
    }
  }
})
