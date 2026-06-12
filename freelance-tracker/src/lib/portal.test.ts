import { describe, it, expect } from 'vitest'
import { groupTasksByStatus, orderProjects, type PortalTask, type PortalProject } from './portal'

function task(over: Partial<PortalTask>): PortalTask {
  return {
    id: 'x', project_id: 'p', title: 'T', description: null,
    status: 'todo', priority: 'medium', start_date: null, due_date: null, updated_at: null,
    ...over,
  }
}

function project(over: Partial<PortalProject>): PortalProject {
  return {
    id: 'x', client_id: 'c', name: 'P', description: null,
    status: 'active', start_date: null, end_date: null,
    ...over,
  }
}

describe('groupTasksByStatus', () => {
  it('buckets tasks into todo / in_progress / done', () => {
    const g = groupTasksByStatus([
      task({ id: '1', status: 'done' }),
      task({ id: '2', status: 'todo' }),
      task({ id: '3', status: 'in_progress' }),
    ])
    expect(g.todo.map((t) => t.id)).toEqual(['2'])
    expect(g.in_progress.map((t) => t.id)).toEqual(['3'])
    expect(g.done.map((t) => t.id)).toEqual(['1'])
  })

  it('orders within a bucket by due_date ascending, undated last, ties by title', () => {
    const g = groupTasksByStatus([
      task({ id: 'a', title: 'Zeta', due_date: null }),
      task({ id: 'b', title: 'Alpha', due_date: '2026-07-01' }),
      task({ id: 'c', title: 'Beta', due_date: '2026-06-15' }),
      task({ id: 'd', title: 'Alpha', due_date: null }),
    ])
    expect(g.todo.map((t) => t.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('orderProjects', () => {
  it('orders active, completed, on_hold, cancelled; by name within a group', () => {
    const out = orderProjects([
      project({ id: '1', status: 'cancelled', name: 'A' }),
      project({ id: '2', status: 'active', name: 'B' }),
      project({ id: '3', status: 'on_hold', name: 'C' }),
      project({ id: '4', status: 'active', name: 'A' }),
      project({ id: '5', status: 'completed', name: 'D' }),
    ])
    expect(out.map((p) => p.id)).toEqual(['4', '2', '5', '3', '1'])
  })

  it('puts unknown statuses last without crashing', () => {
    const out = orderProjects([
      project({ id: '1', status: 'mystery' }),
      project({ id: '2', status: 'active' }),
    ])
    expect(out.map((p) => p.id)).toEqual(['2', '1'])
  })
})
