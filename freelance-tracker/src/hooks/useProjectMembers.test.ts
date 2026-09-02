import { describe, it, expect } from 'vitest'
import { normalizeEmail } from './useProjectMembers'

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Colleague@Example.COM ')).toBe('colleague@example.com')
  })
  it('rejects things that are not emails', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('nope')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a b@c.com')).toBeNull()
  })
})
