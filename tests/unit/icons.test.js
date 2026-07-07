import { describe, expect, it } from 'vitest'
import { createIcon } from '../../src/utils/icons.js'

describe('createIcon', () => {
  it('creates an accessible SVG shell for a known icon', () => {
    const icon = createIcon('trash', 24)

    expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(icon.getAttribute('viewBox')).toBe('0 0 256 256')
    expect(icon.getAttribute('width')).toBe('24')
    expect(icon.getAttribute('height')).toBe('24')
    expect(icon.querySelector('path')).not.toBeNull()
  })

  it('keeps unknown icons empty instead of injecting unexpected markup', () => {
    const icon = createIcon('unknown-icon')

    expect(icon.innerHTML).toBe('')
  })
})
