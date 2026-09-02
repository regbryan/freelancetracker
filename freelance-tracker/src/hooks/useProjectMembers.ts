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

  const fetchMembers = useCallback(async () => {
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
      if (fetchError) throw fetchError
      setMembers((data ?? []) as ProjectMember[])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch collaborators'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const addMember = useCallback(
    async (rawEmail: string): Promise<void> => {
      if (!projectId) return
      const email = normalizeEmail(rawEmail)
      if (!email) throw new Error('invalid' satisfies AddMemberError)
      const { error: err } = await supabase.from('project_members').insert({ project_id: projectId, email })
      if (err) {
        if (err.code === '23505') throw new Error('duplicate' satisfies AddMemberError)
        throw err
      }
      await fetchMembers()
    },
    [projectId, fetchMembers],
  )

  const removeMember = useCallback(
    async (id: string): Promise<void> => {
      const { error: err } = await supabase.from('project_members').delete().eq('id', id)
      if (err) throw err
      setMembers((prev) => prev.filter((m) => m.id !== id))
    },
    [],
  )

  return { members, loading, error, addMember, removeMember, refetch: fetchMembers }
}
