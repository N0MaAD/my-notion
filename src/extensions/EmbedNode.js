import { Node, mergeAttributes } from '@tiptap/core'

export const EmbedNode = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      label: { default: '' },
      width: { default: null },
      height: { default: 300 }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-embed-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-embed-block': '',
      'class': 'node-embed-block'
    })]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.classList.add('node-embed-block')
      dom.contentEditable = 'false'

      // Header
      const header = document.createElement('div')
      header.classList.add('node-embed-header')

      const label = document.createElement('span')
      label.textContent = `🔗 ${node.attrs.label || node.attrs.url}`

      const deleteBtn = document.createElement('button')
      deleteBtn.classList.add('node-delete-btn')
      deleteBtn.textContent = '✕'
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const pos = getPos()
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
      })

      header.appendChild(label)
      header.appendChild(deleteBtn)

      // Iframe wrapper
      const wrapper = document.createElement('div')
      wrapper.classList.add('node-embed-wrapper')
      wrapper.style.height = (node.attrs.height || 300) + 'px'
      if (node.attrs.width) wrapper.style.width = node.attrs.width + 'px'

      const iframe = document.createElement('iframe')
      iframe.src = node.attrs.url
      iframe.classList.add('node-embed-frame')
      iframe.frameBorder = '0'
      iframe.allowFullscreen = true

      // Resize handle
      const handle = document.createElement('div')
      handle.classList.add('embed-resize-handle')
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const startX = e.clientX
        const startY = e.clientY
        const startW = wrapper.offsetWidth
        const startH = wrapper.offsetHeight

        function onMove(e) {
          wrapper.style.width = Math.max(200, startW + (e.clientX - startX)) + 'px'
          wrapper.style.height = Math.max(150, startH + (e.clientY - startY)) + 'px'
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
        }
        document.body.style.cursor = 'nwse-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })

      wrapper.appendChild(iframe)
      wrapper.appendChild(handle)

      dom.appendChild(header)
      dom.appendChild(wrapper)

      return { dom }
    }
  }
})