import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

const LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'xml', label: 'XML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'lua', label: 'Lua' },
  { value: 'perl', label: 'Perl' },
  { value: 'r', label: 'R' },
  { value: 'diff', label: 'Diff' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'ini', label: 'INI' },
  { value: 'makefile', label: 'Makefile' },
  { value: 'plaintext', label: 'Texte brut' },
]

export function createCodeBlock(lowlight) {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ({ node, getPos, editor }) => {
        const dom = document.createElement('pre')
        const code = document.createElement('code')
        dom.appendChild(code)

        const select = document.createElement('select')
        select.className = 'code-lang-select'
        select.contentEditable = 'false'

        LANGUAGES.forEach(lang => {
          const opt = document.createElement('option')
          opt.value = lang.value
          opt.textContent = lang.label
          select.appendChild(opt)
        })

        select.value = node.attrs.language || ''

        select.addEventListener('change', () => {
          const pos = getPos()
          if (pos == null) return
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              language: select.value || null
            })
          )
        })

        dom.appendChild(select)

        return {
          dom,
          contentDOM: code,
          update(updatedNode) {
            if (updatedNode.type.name !== 'codeBlock') return false
            node = updatedNode
            select.value = node.attrs.language || ''
            return true
          }
        }
      }
    }
  }).configure({
    lowlight,
    defaultLanguage: null,
  })
}
