import { Node } from '@tiptap/core'

export const MapNode = Node.create({
  name: 'mapBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      address: { default: 'Paris, France' },
      zoom: { default: 15 }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-map]' }]
  },

  renderHTML({ node }) {
    return ['div', {
      'data-map': '',
      class: 'map-block'
    }, `[Carte: ${node.attrs.address}]`]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'map-block'

      function render() {
        dom.innerHTML = ''

        const label = document.createElement('div')
        label.className = 'map-label'
        label.textContent = `📍 ${node.attrs.address}`
        dom.appendChild(label)

        const iframe = document.createElement('iframe')
        const q = encodeURIComponent(node.attrs.address || 'Paris')
        iframe.src = `https://maps.google.com/maps?q=${q}&t=&z=${node.attrs.zoom || 15}&ie=UTF8&iwloc=&output=embed`
        iframe.className = 'map-iframe'
        iframe.setAttribute('frameborder', '0')
        iframe.setAttribute('allowfullscreen', '')
        iframe.setAttribute('loading', 'lazy')
        iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
        dom.appendChild(iframe)
      }

      render()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mapBlock') return false
          node = updatedNode
          render()
          return true
        }
      }
    }
  }
})
