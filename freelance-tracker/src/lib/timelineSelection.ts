/**
 * Which project the timeline is showing.
 *
 * The page shows one project at a time — 18 projects stacked into one Gantt was a
 * wall of bars nobody could read. `OVERVIEW` is the one exception: a bird's-eye
 * mode with a single bar per project and no task rows.
 */

/** Sentinel selection: every project, one bar each, no tasks. Also the `?project=` value. */
export const OVERVIEW = 'all'

/** The only project fields the selection rules need. */
export interface SelectableProject {
  id: string
  status: string
  updated_at: string
}

/** ISO timestamps sort correctly as strings, so no Date allocation per comparison. */
function byUpdatedDesc(a: SelectableProject, b: SelectableProject): number {
  if (a.updated_at === b.updated_at) return 0
  return a.updated_at < b.updated_at ? 1 : -1
}

/**
 * Decide what the timeline should show, in priority order:
 * 1. an explicit `?project=` value (Overview or a project that still exists),
 * 2. the last selection remembered in localStorage, under the same validity rule,
 * 3. the most recently updated *active* project,
 * 4. the most recently updated project of any status,
 * 5. Overview — the workspace has no projects at all.
 *
 * Steps 1 and 2 re-validate against `projects` so a link to a deleted project, or a
 * stale remembered id, lands somewhere useful instead of on an empty grid.
 */
export function resolveSelection(
  param: string | null,
  stored: string | null,
  projects: readonly SelectableProject[],
): string {
  const isUsable = (v: string | null): v is string =>
    v === OVERVIEW || (v !== null && v !== '' && projects.some((p) => p.id === v))

  if (isUsable(param)) return param
  if (isUsable(stored)) return stored

  const active = projects.filter((p) => p.status === 'active').sort(byUpdatedDesc)
  if (active.length > 0) return active[0].id

  const anyProject = projects.slice().sort(byUpdatedDesc)
  if (anyProject.length > 0) return anyProject[0].id

  return OVERVIEW
}

/**
 * The projects that get a one-click chip in the switcher: the most recently updated
 * active projects, capped at `max`.
 *
 * The selected project is always present, even when it is paused, finished, or long
 * enough down the recency list to fall outside the cap — a switcher that cannot show
 * you where you are is worse than one item shorter. When it has to be added it takes
 * the last slot, so the list never grows past `max`.
 */
export function quickPickProjects<T extends SelectableProject>(
  projects: readonly T[],
  selectedId: string,
  max = 6,
): T[] {
  if (max <= 0) return []

  const picked = projects.filter((p) => p.status === 'active').sort(byUpdatedDesc).slice(0, max)
  if (selectedId === OVERVIEW || picked.some((p) => p.id === selectedId)) return picked

  const selected = projects.find((p) => p.id === selectedId)
  if (!selected) return picked

  return [...picked.slice(0, max - 1), selected]
}
