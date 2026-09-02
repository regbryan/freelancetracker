import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ProjectMember {
  id: string
  project_id: string
  email: string
  role: 'editor'
  created_at: string
}

/** Trim + lower-case; null when it is not a plausible email. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** Thrown by addMember so the UI can map to a translated message. */
export type AddMemberError = 'invalid' | 'duplicate'

export function useProjectMembers(projectId: string | undefined) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // `isCancelled` lets an in-flight request from a previous projectId (or an
  // unmounted component) discover it's stale and skip applying its result —
  // same pattern as src/hooks/useGmail.ts.
  const fetchMembers = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      if (!projectId) {
        setMembers([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('project_members')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
        if (isCancelled()) return
        if (fetchError) {
          // The migration may not be applied yet — treat a missing table as
          // "no collaborators" rather than surfacing a scary error.
          if (fetchError.code === 'PGRST205') setMembers([])
          else setError(fetchError.message)
        } else {
          setMembers((data ?? []) as ProjectMember[])
        }
      } catch (err: unknown) {
        if (isCancelled()) return
        const message = err instanceof Error ? err.message : 'Failed to fetch collaborators'
        setError(message)
      } finally {
        if (!isCancelled()) setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    let cancelled = false
    fetchMembers(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [fetchMembers])

  const addMember = useCallback(
    async (rawEmail: string): Promise<void> => {
      if (!projectId) return
      const email = normalizeEmail(rawEmail)
      if (!email) throw new Error('invalid' satisfies AddMemberError)
      const { data, error: err } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, email })
        .select()
        .single()
      if (err) {
        if (err.code === '23505') throw new Error('duplicate' satisfies AddMemberError)
        throw err
      }
      setMembers((prev) => [...prev, data as ProjectMember])
    },
    [projectId],
  )

  const removeMember = useCallback(
    async (id: string): Promise<void> => {
      const { data, error: err } = await supabase.from('project_members').delete().eq('id', id).select('id')
      if (err) throw err
      // RLS silently filters rows the caller isn't allowed to delete instead
      // of erroring, so an empty result means nothing was actually removed.
      if (!data || data.length === 0) throw new Error('failed')
      setMembers((prev) => prev.filter((m) => m.id !== id))
    },
    [],
  )

  return { members, loading, error, addMember, removeMember, refetch: fetchMembers }
}
