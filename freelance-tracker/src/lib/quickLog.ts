export interface ProjectRef {
  id: string
  name: string
}

/** Structural subset of hooks/useTimeEntries' TimeEntry — keeps this module React/Supabase-free. */
export interface EntryLike {
  project_id: string
  description: string | null
  hours: number
  date: string
  created_at: string
}

export interface Suggestion {
  description: string
  hours: number
}

/** Round up to the nearest 0.25h — same rule TimeEntryForm has always applied. */
export function roundQuarterHour(hours: number): number {
  return Math.ceil(hours * 4) / 4
}

function byRecency(a: EntryLike, b: EntryLike): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date)
  return b.created_at.localeCompare(a.created_at)
}

/**
 * Projects ordered by most recently logged-against; projects never logged
 * against follow in their given order. Capped at max.
 */
export function recentProjects(entries: EntryLike[], projects: ProjectRef[], max = 5): ProjectRef[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const out: ProjectRef[] = []
  const seen = new Set<string>()

  for (const e of [...entries].sort(byRecency)) {
    if (out.length >= max) return out
    if (seen.has(e.project_id)) continue
    const p = byId.get(e.project_id)
    if (p) {
      out.push(p)
      seen.add(p.id)
    }
  }
  for (const p of projects) {
    if (out.length >= max) break
    if (!seen.has(p.id)) {
      out.push(p)
      seen.add(p.id)
    }
  }
  return out
}

/**
 * Deduped, recent-first description suggestions for one project, filtered by
 * the text typed so far. Selecting one also pre-fills its hours.
 */
export function descriptionSuggestions(
  entries: EntryLike[],
  projectId: string,
  query: string,
  max = 8,
): Suggestion[] {
  const q = query.trim().toLowerCase()
  const out: Suggestion[] = []
  const seen = new Set<string>()

  for (const e of [...entries].sort(byRecency)) {
    if (out.length >= max) break
    if (e.project_id !== projectId) continue
    const description = (e.description ?? '').trim()
    if (!description) continue
    const key = description.toLowerCase()
    if (seen.has(key)) continue
    if (q && (!key.includes(q) || key === q)) continue
    out.push({ description, hours: e.hours })
    seen.add(key)
  }
  return out
}
