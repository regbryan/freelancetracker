import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Milestone {
  id: string
  project_id: string
  name: string
  start_date: string | null
  end_date: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MilestoneInsert {
  project_id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  sort_order?: number
}

export type MilestoneUpdate = Partial<Omit<MilestoneInsert, 'project_id'>>

/**
 * Milestones for one project, or every milestone the caller can see when
 * `projectId` is undefined (the Overview needs them all to draw its diamonds).
 *
 * `milestones.user_id` defaults to auth.uid() in the database, so inserts here
 * never send it — a collaborator creating a milestone is allowed by RLS on the
 * strength of their project membership, not of that column.
 */
export function useMilestones(projectId?: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // `isCancelled` lets an in-flight request from a previous projectId (or an
  // unmounted component) discover it's stale and skip applying its result —
  // same pattern as src/hooks/useProjectMembers.ts.
  const fetchMilestones = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      setLoading(true)
      setError(null)
      try {
        let query = supabase
          .from('milestones')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('start_date', { ascending: true, nullsFirst: false })
        if (projectId) query = query.eq('project_id', projectId)

        const { data, error: fetchError } = await query
        if (isCancelled()) return
        if (fetchError) {
          // The migration may not be applied yet — treat a missing table as
          // "no milestones" rather than surfacing a scary error.
          if (fetchError.code === 'PGRST205') setMilestones([])
          else setError(fetchError.message)
        } else {
          setMilestones((data ?? []) as Milestone[])
        }
      } catch (err: unknown) {
        if (isCancelled()) return
        const message = err instanceof Error ? err.message : 'Failed to fetch milestones'
        setError(message)
      } finally {
        if (!isCancelled()) setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    let cancelled = false
    fetchMilestones(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [fetchMilestones])

  const createMilestone = useCallback(async (input: MilestoneInsert): Promise<Milestone> => {
    const { data, error: err } = await supabase.from('milestones').insert(input).select().single()
    if (err) throw err
    setMilestones((prev) => [...prev, data as Milestone])
    return data as Milestone
  }, [])

  const updateMilestone = useCallback(async (id: string, updates: MilestoneUpdate): Promise<Milestone> => {
    // No database trigger keeps updated_at current, so the app sends it.
    // maybeSingle, not single: RLS makes a milestone the caller can no longer reach
    // (membership revoked mid-session) look like a zero-row update, and single() would
    // surface that as a cryptic PGRST116. Same mapping as useTasks.updateTask, which is
    // what the page's failMessage() turns into "You no longer have access…".
    const { data, error: err } = await supabase
      .from('milestones')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (err) throw err
    if (!data) throw new Error('no-access')
    setMilestones((prev) => prev.map((m) => (m.id === id ? (data as Milestone) : m)))
    return data as Milestone
  }, [])

  const deleteMilestone = useCallback(async (id: string): Promise<void> => {
    const { data, error: err } = await supabase.from('milestones').delete().eq('id', id).select('id')
    if (err) throw err
    // RLS silently filters rows the caller isn't allowed to delete instead of
    // erroring, so an empty result means nothing was actually removed — the same
    // lost-access case updateMilestone reports, and the page maps 'no-access' to a
    // message that says so rather than a generic failure.
    if (!data || (data as unknown[]).length === 0) throw new Error('no-access')
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { milestones, loading, error, createMilestone, updateMilestone, deleteMilestone, refetch: fetchMilestones }
}
