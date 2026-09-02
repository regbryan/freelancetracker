import { describe, it, expect } from 'vitest'
import { OVERVIEW, resolveSelection, quickPickProjects, type SelectableProject } from './timelineSelection'

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

describe('quickPickProjects', () => {
  const many: SelectableProject[] = [
    p('a', 'active', '01'),
    p('b', 'active', '02'),
    p('c', 'active', '03'),
    p('d', 'active', '04'),
    p('e', 'active', '05'),
    p('f', 'active', '06'),
    p('g', 'active', '07'),
    p('old', 'completed', '28'),
  ]

  it('returns the active projects, newest first', () => {
    expect(quickPickProjects(projects, OVERVIEW).map((x) => x.id)).toEqual(['alpha', 'beta'])
  })

  it('leaves out non-active projects', () => {
    expect(quickPickProjects(projects, OVERVIEW).map((x) => x.id)).not.toContain('zeta')
  })

  it('caps the list at max', () => {
    expect(quickPickProjects(many, OVERVIEW).map((x) => x.id)).toEqual(['g', 'f', 'e', 'd', 'c', 'b'])
    expect(quickPickProjects(many, OVERVIEW, 3).map((x) => x.id)).toEqual(['g', 'f', 'e'])
  })

  it('includes the selected project even when it is not active', () => {
    expect(quickPickProjects(projects, 'zeta').map((x) => x.id)).toEqual(['alpha', 'beta', 'zeta'])
  })

  it('includes the selected project when it falls outside the cap, taking the last slot', () => {
    // 'a' is the oldest active project, so it never makes the top 6 on its own.
    expect(quickPickProjects(many, 'a').map((x) => x.id)).toEqual(['g', 'f', 'e', 'd', 'c', 'a'])
  })

  it('never grows past max when it has to add the selected project', () => {
    expect(quickPickProjects(many, 'old')).toHaveLength(6)
    expect(quickPickProjects(many, 'old', 2).map((x) => x.id)).toEqual(['g', 'old'])
  })

  it('does not duplicate a selected project that is already in the top N', () => {
    const ids = quickPickProjects(many, 'g').map((x) => x.id)
    expect(ids).toEqual(['g', 'f', 'e', 'd', 'c', 'b'])
    expect(ids.filter((x) => x === 'g')).toHaveLength(1)
  })

  it('ignores a selected id that matches no project', () => {
    expect(quickPickProjects(projects, 'gone').map((x) => x.id)).toEqual(['alpha', 'beta'])
  })

  it('returns nothing for a non-positive max', () => {
    expect(quickPickProjects(many, 'a', 0)).toEqual([])
  })

  it('does not mutate the array it is given', () => {
    const input = [...many]
    quickPickProjects(input, 'a')
    expect(input.map((x) => x.id)).toEqual(many.map((x) => x.id))
  })
})
