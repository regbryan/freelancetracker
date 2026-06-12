import { describe, it, expect } from 'vitest'
import { roundQuarterHour, recentProjects, descriptionSuggestions, type EntryLike } from './quickLog'

const projects = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
]

function entry(over: Partial<EntryLike>): EntryLike {
  return {
    project_id: 'a',
    description: 'work',
    hours: 1,
    date: '2026-06-01',
    created_at: '2026-06-01T10:00:00Z',
    ...over,
  }
}

describe('roundQuarterHour', () => {
  it('rounds up to the nearest 0.25', () => {
    expect(roundQuarterHour(1.01)).toBe(1.25)
    expect(roundQuarterHour(0.1)).toBe(0.25)
  })
  it('leaves exact quarters alone', () => {
    expect(roundQuarterHour(2)).toBe(2)
    expect(roundQuarterHour(1.75)).toBe(1.75)
  })
})

describe('recentProjects', () => {
  it('orders projects by most recently logged-against', () => {
    const entries = [
      entry({ project_id: 'b', date: '2026-06-10' }),
      entry({ project_id: 'a', date: '2026-06-08' }),
      entry({ project_id: 'b', date: '2026-06-01' }),
    ]
    expect(recentProjects(entries, projects).map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('breaks same-date ties by created_at', () => {
    const entries = [
      entry({ project_id: 'a', date: '2026-06-10', created_at: '2026-06-10T09:00:00Z' }),
      entry({ project_id: 'b', date: '2026-06-10', created_at: '2026-06-10T17:00:00Z' }),
    ]
    expect(recentProjects(entries, projects)[0].id).toBe('b')
  })

  it('appends never-logged projects in given order and respects max', () => {
    expect(recentProjects([], projects, 2).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('ignores entries for unknown (deleted) projects', () => {
    const entries = [entry({ project_id: 'zombie', date: '2026-06-11' })]
    expect(recentProjects(entries, projects).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('descriptionSuggestions', () => {
  const entries = [
    entry({ project_id: 'a', description: 'Homepage copy', hours: 2, date: '2026-06-10' }),
    entry({ project_id: 'a', description: 'homepage copy', hours: 3, date: '2026-06-01' }), // dup, older
    entry({ project_id: 'a', description: 'Client call', hours: 0.5, date: '2026-06-09' }),
    entry({ project_id: 'b', description: 'Other project work', hours: 1, date: '2026-06-11' }),
    entry({ project_id: 'a', description: null, date: '2026-06-08' }),
  ]

  it('returns recent-first deduped suggestions for the selected project only', () => {
    const s = descriptionSuggestions(entries, 'a', '')
    expect(s).toEqual([
      { description: 'Homepage copy', hours: 2 },
      { description: 'Client call', hours: 0.5 },
    ])
  })

  it('filters by query, case-insensitive', () => {
    expect(descriptionSuggestions(entries, 'a', 'home')).toEqual([
      { description: 'Homepage copy', hours: 2 },
    ])
  })

  it('omits a suggestion identical to the query', () => {
    expect(descriptionSuggestions(entries, 'a', 'Homepage copy')).toEqual([])
  })

  it('respects max', () => {
    expect(descriptionSuggestions(entries, 'a', '', 1)).toHaveLength(1)
  })
})
