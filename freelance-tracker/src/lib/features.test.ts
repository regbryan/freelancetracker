import { describe, it, expect } from 'vitest'
import { isFeatureEnabled, type Feature } from './features'

describe('isFeatureEnabled', () => {
  it('reports the three switched-off features as disabled', () => {
    expect(isFeatureEnabled('meetings')).toBe(false)
    expect(isFeatureEnabled('contracts')).toBe(false)
    expect(isFeatureEnabled('expenses')).toBe(false)
  })

  it('reports the features the owner still uses as enabled', () => {
    expect(isFeatureEnabled('emails')).toBe(true)
    expect(isFeatureEnabled('calendar')).toBe(true)
  })

  it('covers every declared feature', () => {
    const all: Feature[] = ['meetings', 'contracts', 'expenses', 'emails', 'calendar']
    expect(all.filter(isFeatureEnabled)).toEqual(['emails', 'calendar'])
  })
})
