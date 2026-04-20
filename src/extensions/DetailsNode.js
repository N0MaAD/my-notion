import { Node } from '@tiptap/core'

export const DetailsNode = Node.create({
  name: 'detailsBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      summary: { default: 'Menu dépliant' },
      open: { default: true }
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-details]',
      getAttrs: el => ({
        summary: el.getAttribute('data-summary') || 'Menu dépliant',
        open: el.getAttribute('data-open') !== 'false'
      })
    }]
  },

  renderHTML({ node }) {
    return ['div', {
      'data-details': '',
      'data-summary': node.attrs.summary,
      'data-open': String(node.attrs.open),
      class: 'details-block'
    }, 0]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'details-block'

      const summaryEl = document.createElement('div')
      summaryEl.className = 'details-summary'
      summaryEl.contentEditable = 'false'

      const toggleIcon = document.createElement('span')
      toggleIcon.className = 'details-toggle'
      toggleIcon.textContent = node.attrs.open ? '▾' : '›'

      const summaryText = document.createElement('span')
      summaryText.className = 'details-summary-text'
      summaryText.textContent = node.attrs.summary

      summaryEl.appendChild(toggleIcon)
      summaryEl.appendChild(summaryText)

      const contentEl = document.createElement('div')
      contentEl.className = 'details-content'
      if (!node.attrs.open) contentEl.style.display = 'none'

      summaryEl.addEventListener('click', () => {
        const pos = getPos()
        if (pos == null) return
        const newOpen = !node.attrs.open
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            open: newOpen
          })
        )
      })

      dom.appendChild(summaryEl)
      dom.appendChild(contentEl)

      return {
        dom,
        contentDOM: contentEl,
        update(updatedNode) {
          if (updatedNode.type.name !== 'detailsBlock') return false
          node = updatedNode
          toggleIcon.textContent = node.attrs.open ? '▾' : '›'
          contentEl.style.display = node.attrs.open ? '' : 'none'
          summaryText.textContent = node.attrs.summary
          return true
        }
      }
    }
  }
})
