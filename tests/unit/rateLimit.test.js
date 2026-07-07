import { afterEach, describe, expect, it, vi } from 'vitest'
import { rateLimit } from '../../src/utils/rateLimit.js'

describe('rateLimit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows the first action for a key', () => {
    let now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    expect(rateLimit(`first-call-${Math.random()}`, 500)).toBe(true)
  })

  it('blocks repeated actions until the interval has elapsed', () => {
    let now = 10_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const key = `repeat-${Math.random()}`

    expect(rateLimit(key, 1_000)).toBe(true)

    now = 10_500
    expect(rateLimit(key, 1_000)).toBe(false)

    now = 11_000
    expect(rateLimit(key, 1_000)).toBe(true)
  })
})
