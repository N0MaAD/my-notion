import { Node, mergeAttributes } from '@tiptap/core'

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
      ['div', { class: 'audio-label' }, `🔊 ${node.attrs.title || 'Audio'}`],
      ['audio', { src: node.attrs.src, controls: '', preload: 'metadata', class: 'audio-player' }]
    ]
  }
})
