/**
 * Pure helpers for the milestones layer: spans, progress, grouping, ordering.
 * No React, no Supabase — the Gantt, the page, and the portal all use these.
 * Dates are ISO `yyyy-mm-dd` strings, compared with string ordering.
 */
import { entityRange, type DateRange } from './timelineMath'

/** Structural subset of hooks/useMilestones' Milestone and lib/portal's PortalMilestone. */
export interface MilestoneLike {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  sort_order: number
}

/** Structural subset of hooks/useTasks' Task and lib/portal's PortalTask. */
export interface MilestoneTaskLike {
  milestone_id: string | null
  status: 'todo' | 'in_progress' | 'done'
  start_date: string | null
  due_date: string | null
}

/**
 * The span to draw for a milestone: its own dates when it has both, otherwise
 * the extent of its tasks' ranges, otherwise nothing to draw.
 * `tasks` may be the whole list — only the ones pointing at `m` are used.
 */
export function milestoneRange(m: MilestoneLike, tasks: MilestoneTaskLike[]): DateRange | null {
  if (m.start_date && m.end_date) return entityRange(m.start_date, m.end_date)

  let start: string | null = null
  let end: string | null = null
  for (const t of tasks) {
    if (t.milestone_id !== m.id) continue
    const r = entityRange(t.start_date, t.due_date)
    if (!r) continue
    if (!start || r.start < start) start = r.start
    if (!end || r.end > end) end = r.end
  }
  return start && end ? { start, end } : null
}

/** Done / total task counts for one milestone, for the bar fill and the row label. */
export function milestoneProgress(m: MilestoneLike, tasks: MilestoneTaskLike[]): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const t of tasks) {
    if (t.milestone_id !== m.id) continue
    total += 1
    if (t.status === 'done') done += 1
  }
  return { done, total }
}

/**
 * Split tasks into per-milestone buckets plus the leftovers, preserving the
 * order they arrived in. Every milestone gets an entry, even an empty one, so
 * callers can render a milestone row without a presence check.
 */
export function groupTasksByMilestone<T extends MilestoneTaskLike>(
  tasks: T[],
  milestones: MilestoneLike[],
): { byMilestone: Map<string, T[]>; unassigned: T[] } {
  const byMilestone = new Map<string, T[]>()
  for (const m of milestones) byMilestone.set(m.id, [])
  const unassigned: T[] = []
  for (const t of tasks) {
    const bucket = t.milestone_id ? byMilestone.get(t.milestone_id) : undefined
    if (bucket) bucket.push(t)
    else unassigned.push(t)
  }
  return { byMilestone, unassigned }
}

/** sort_order, then start_date (undated last), then name. Returns a new array. */
export function sortMilestones<T extends MilestoneLike>(ms: T[]): T[] {
  return [...ms].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    if (a.start_date !== b.start_date) {
      if (!a.start_date) return 1
      if (!b.start_date) return -1
      return a.start_date.localeCompare(b.start_date)
    }
    return a.name.localeCompare(b.name)
  })
}
