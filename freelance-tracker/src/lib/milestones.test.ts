import { describe, it, expect } from 'vitest'
import {
  groupTasksByMilestone,
  milestoneProgress,
  milestoneRange,
  sortMilestones,
  type MilestoneLike,
  type MilestoneTaskLike,
} from './milestones'

function ms(over: Partial<MilestoneLike> & { id: string }): MilestoneLike {
  return { name: over.id, start_date: null, end_date: null, sort_order: 0, ...over }
}

function task(over: Partial<MilestoneTaskLike> = {}): MilestoneTaskLike & { id: string } {
  return {
    id: Math.random().toString(36).slice(2),
    milestone_id: null,
    status: 'todo',
    start_date: null,
    due_date: null,
    ...over,
  }
}

describe('milestoneRange', () => {
  it('uses the milestone own dates when it has both', () => {
    const m = ms({ id: 'm1', start_date: '2026-09-01', end_date: '2026-09-30' })
    const tasks = [task({ milestone_id: 'm1', start_date: '2026-01-01', due_date: '2026-01-02' })]
    expect(milestoneRange(m, tasks)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('normalizes its own dates when they are reversed', () => {
    const m = ms({ id: 'm1', start_date: '2026-09-30', end_date: '2026-09-01' })
    expect(milestoneRange(m, [])).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('falls back to the extent of its tasks when a date is missing', () => {
    const m = ms({ id: 'm1', start_date: '2026-09-01' })
    const tasks = [
      task({ milestone_id: 'm1', start_date: '2026-09-10', due_date: '2026-09-12' }),
      task({ milestone_id: 'm1', due_date: '2026-09-20' }),
      task({ milestone_id: 'other', start_date: '2020-01-01', due_date: '2030-01-01' }),
      task({ milestone_id: 'm1' }),
    ]
    expect(milestoneRange(m, tasks)).toEqual({ start: '2026-09-10', end: '2026-09-20' })
  })

  it('returns null with no dates of its own and no dated tasks', () => {
    const m = ms({ id: 'm1' })
    expect(milestoneRange(m, [task({ milestone_id: 'm1' })])).toBeNull()
    expect(milestoneRange(m, [])).toBeNull()
  })
})

describe('milestoneProgress', () => {
  it('counts only its own tasks', () => {
    const m = ms({ id: 'm1' })
    const tasks = [
      task({ milestone_id: 'm1', status: 'done' }),
      task({ milestone_id: 'm1', status: 'in_progress' }),
      task({ milestone_id: 'm1', status: 'todo' }),
      task({ milestone_id: 'm2', status: 'done' }),
      task({ status: 'done' }),
    ]
    expect(milestoneProgress(m, tasks)).toEqual({ done: 1, total: 3 })
  })

  it('is zero/zero for an empty milestone', () => {
    expect(milestoneProgress(ms({ id: 'm1' }), [])).toEqual({ done: 0, total: 0 })
  })
})

describe('groupTasksByMilestone', () => {
  it('buckets tasks by milestone and keeps their order', () => {
    const milestones = [ms({ id: 'm1' }), ms({ id: 'm2' })]
    const a = task({ milestone_id: 'm1', status: 'todo' })
    const b = task({ milestone_id: 'm2' })
    const c = task({ milestone_id: 'm1', status: 'done' })
    const d = task()
    const { byMilestone, unassigned } = groupTasksByMilestone([a, b, c, d], milestones)
    expect(byMilestone.get('m1')).toEqual([a, c])
    expect(byMilestone.get('m2')).toEqual([b])
    expect(unassigned).toEqual([d])
  })

  it('gives every milestone an entry, even an empty one', () => {
    const { byMilestone } = groupTasksByMilestone([], [ms({ id: 'm1' })])
    expect(byMilestone.get('m1')).toEqual([])
  })

  it('treats a task pointing at an unknown milestone as unassigned', () => {
    const stray = task({ milestone_id: 'gone' })
    const { byMilestone, unassigned } = groupTasksByMilestone([stray], [ms({ id: 'm1' })])
    expect(unassigned).toEqual([stray])
    expect(byMilestone.get('m1')).toEqual([])
  })
})

describe('sortMilestones', () => {
  it('orders by sort_order, then start_date with undated last, then name', () => {
    const input = [
      ms({ id: 'c', name: 'C', sort_order: 1, start_date: '2026-01-01' }),
      ms({ id: 'b', name: 'B', sort_order: 0, start_date: null }),
      ms({ id: 'a', name: 'A', sort_order: 0, start_date: '2026-05-01' }),
      ms({ id: 'z', name: 'Z', sort_order: 0, start_date: '2026-05-01' }),
      ms({ id: 'y', name: 'Y', sort_order: 0, start_date: '2026-02-01' }),
    ]
    expect(sortMilestones(input).map((m) => m.id)).toEqual(['y', 'a', 'z', 'b', 'c'])
  })

  it('does not mutate its input', () => {
    const input = [ms({ id: 'b', sort_order: 1 }), ms({ id: 'a', sort_order: 0 })]
    const out = sortMilestones(input)
    expect(input.map((m) => m.id)).toEqual(['b', 'a'])
    expect(out.map((m) => m.id)).toEqual(['a', 'b'])
  })
})
