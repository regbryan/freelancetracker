import { describe, it, expect } from 'vitest'
import { OVERVIEW, resolveSelection, type SelectableProject } from './timelineSelection'

function p(id: string, status: string, updated: string): SelectableProject {
  return { id, status, updated_at: `2026-08-${updated}T00:00:00Z` }
}

/** Alpha is the newest active one; Beta is older; Zeta is newer than both but on hold. */
const projects: SelectableProject[] = [
  p('beta', 'active', '02'),
  p('alpha', 'active', '10'),
  p('zeta', 'on_hold', '20'),
  p('omega', 'completed', '01'),
]

describe('resolveSelection', () => {
  it('uses the URL param when it is a real project id', () => {
    expect(resolveSelection('beta', 'alpha', projects)).toBe('beta')
  })

  it('uses the URL param when it is Overview', () => {
    expect(resolveSelection(OVERVIEW, 'alpha', projects)).toBe(OVERVIEW)
  })

  it('falls through to the stored value when the param is missing', () => {
    expect(resolveSelection(null, 'zeta', projects)).toBe('zeta')
  })

  it('falls through to the stored value when the param names a deleted project', () => {
    expect(resolveSelection('gone', 'beta', projects)).toBe('beta')
  })

  it('accepts Overview from storage', () => {
    expect(resolveSelection(null, OVERVIEW, projects)).toBe(OVERVIEW)
  })

  it('picks the most recently updated active project when neither source is usable', () => {
    expect(resolveSelection(null, null, projects)).toBe('alpha')
  })

  it('ignores a stale stored id the same way it ignores a stale param', () => {
    expect(resolveSelection('gone', 'also-gone', projects)).toBe('alpha')
  })

  it('does not prefer a newer non-active project over an older active one', () => {
    // zeta (on_hold) is the newest row of all; alpha still wins because it is active.
    expect(resolveSelection(null, null, projects)).not.toBe('zeta')
  })

  it('falls back to the most recently updated project of any status when none are active', () => {
    const none = projects.filter((x) => x.status !== 'active')
    expect(resolveSelection(null, null, none)).toBe('zeta')
  })

  it('returns Overview when there are no projects at all', () => {
    expect(resolveSelection(null, null, [])).toBe(OVERVIEW)
    expect(resolveSelection('gone', 'also-gone', [])).toBe(OVERVIEW)
  })

  it('treats an empty-string param or stored value as absent', () => {
    expect(resolveSelection('', '', projects)).toBe('alpha')
  })
})
