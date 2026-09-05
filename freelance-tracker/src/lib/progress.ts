/**
 * Pure helpers for task percent-complete and the assignee picker.
 * No React, no Supabase — the Gantt, the Timeline page and the portal share these.
 *
 * `progress` is a whole percentage 0–100. Until
 * `supabase_migration_task_progress.sql` runs the column is absent from every
 * row, so every helper here treats `undefined`/`null` as 0 rather than NaN.
 */

/** Structural subset of useTasks' Task and lib/portal's PortalTask. */
export interface ProgressTaskLike {
  progress?: number | null
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'

/** A whole percentage inside 0–100. Anything unusable (NaN, null, ±∞) is 0. */
export function clampProgress(n: number | null | undefined): number {
  if (n === null || n === undefined) return 0
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, Math.round(v)))
}

/**
 * The status a task should carry once its progress is set to `progress`.
 * 100 finishes it; dropping a finished task below 100 reopens it as in
 * progress; anything else leaves the status the user chose alone — a task at
 * 40% may legitimately be `todo` (planned, not started) or `in_progress`.
 */
export function statusForProgress(prev: TaskStatus, progress: number): TaskStatus {
  const p = clampProgress(progress)
  if (p === 100) return 'done'
  if (prev === 'done') return 'in_progress'
  return prev
}

/** Rolled-up percentage: the mean of the tasks' progress, rounded. 0 for none. */
export function meanProgress(tasks: readonly ProgressTaskLike[]): number {
  if (tasks.length === 0) return 0
  let total = 0
  for (const t of tasks) total += clampProgress(t.progress)
  return Math.round(total / tasks.length)
}

/**
 * Hours the way a person writes them: `4`, not `4.00`; `4.5`, not `4.50`.
 * NUMERIC(6,2) comes back from Postgres as a string in some drivers, so this
 * coerces first and treats anything unusable as 0.
 */
export function formatHours(n: number | string | null | undefined): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return String(Math.round(v * 100) / 100)
}

/**
 * How an `assignee` value should read on screen.
 *
 * - `'me'` is the project owner: their profile name, or "Me" when they have not
 *   set one.
 * - An email that belongs to one of the project's members is shown as the
 *   capitalised local part (`courtney@acme.com` → "Courtney"), which is what a
 *   plan is read with; the full address is for the picker's value, not the eye.
 * - Empty or null is unassigned.
 * - Anything else is text somebody typed (the client names carried over from
 *   meeting notes) and is shown exactly as stored.
 */
export function assigneeLabel(
  assignee: string | null | undefined,
  ownerName: string | null | undefined,
  members: readonly string[],
): string {
  const value = (assignee ?? '').trim()
  if (value === '') return 'Unassigned'
  if (value === 'me') return (ownerName ?? '').trim() || 'Me'
  const lower = value.toLowerCase()
  const match = members.find((m) => m.trim().toLowerCase() === lower)
  if (!match) return value
  const local = lower.slice(0, lower.indexOf('@'))
  if (local === '') return value
  return local.charAt(0).toUpperCase() + local.slice(1)
}

/**
 * The one or two letters that stand for a person on a bar, where there is room
 * for a 20px circle and nothing more. Takes the *display* label (what
 * `assigneeLabel` returned), never the raw value: the circle's title carries
 * the full name, so the initials only have to be recognisable next to it.
 *
 * "Reggie Bryant" → "RB", "Courtney" → "C", "Jamie at SiFive" → "JS" (first and
 * last word, never the middle), and an address that slipped through loses its
 * domain first so "courtney@acme.com" is "C", not "CA".
 */
export function assigneeInitials(label: string | null | undefined): string {
  let text = (label ?? '').trim()
  if (text === '') return ''
  const at = text.indexOf('@')
  if (at > 0) text = text.slice(0, at)
  const words = text.split(/[\s._-]+/).filter((w) => w.length > 0)
  if (words.length === 0) return ''
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}
