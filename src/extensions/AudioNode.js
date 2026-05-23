import { Node, mergeAttributes } from '@tiptap/core'
import { createIcon } from '../utils/icons.js'

export const AudioNode = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: '' }
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-audio]',
      getAttrs: el => ({
        src: el.querySelector('audio')?.getAttribute('src') || el.getAttribute('data-src'),
        title: el.getAttribute('data-title') || ''
      })
    }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-audio': '',
      'data-src': node.attrs.src,
      'data-title': node.attrs.title,
      class: 'audio-block'
    }),
      ['div', { class: 'audio-label' }, node.attrs.title || 'Audio'],
      ['audio', { src: node.attrs.src, controls: '', preload: 'metadata', class: 'audio-player' }]
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'audio-block'

      const label = document.createElement('div')
      label.className = 'audio-label'
      label.appendChild(createIcon('equalizer', 14))
      label.appendChild(document.createTextNode(` ${node.attrs.title || 'Audio'}`))
      dom.appendChild(label)

      const audio = document.createElement('audio')
      audio.src = node.attrs.src
      audio.controls = true
      audio.preload = 'metadata'
      audio.className = 'audio-player'
      dom.appendChild(audio)

      return { dom }
    }
  }
})
