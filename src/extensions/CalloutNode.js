import { Node, mergeAttributes } from '@tiptap/core'

export const CalloutNode = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: { default: '💡' }
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-callout]',
      getAttrs: el => ({ emoji: el.getAttribute('data-emoji') || '💡' })
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
  }
})
