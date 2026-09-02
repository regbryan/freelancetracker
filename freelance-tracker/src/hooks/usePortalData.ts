import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PortalClient, PortalMilestone, PortalProject, PortalTask } from '../lib/portal'

/**
 * Reads the portal_* views. The database scopes every row to the logged-in JWT
 * email, so this hook does no filtering of its own.
 */
export function usePortalData() {
  const [clients, setClients] = useState<PortalClient[]>([])
  const [projects, setProjects] = useState<PortalProject[]>([])
  const [tasks, setTasks] = useState<PortalTask[]>([])
  const [milestones, setMilestones] = useState<PortalMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, p, t, m] = await Promise.all([
        supabase.from('portal_clients').select('*'),
        supabase.from('portal_projects').select('*'),
        supabase.from('portal_tasks').select('*'),
        supabase.from('portal_milestones').select('*'),
      ])
      const firstError = c.error ?? p.error ?? t.error
      if (firstError) throw firstError
      // The milestones migration may not be applied yet — a missing view means
      // "no milestones", not a broken portal.
      if (m.error && m.error.code !== 'PGRST205') throw m.error
      setClients((c.data ?? []) as PortalClient[])
      setProjects((p.data ?? []) as PortalProject[])
      setTasks((t.data ?? []) as PortalTask[])
      setMilestones((m.error ? [] : (m.data ?? [])) as PortalMilestone[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portal data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    clients,
    projects,
    tasks,
    milestones,
    loading,
    error,
    refetch: fetchAll,
    /** True once loaded if the signed-in email matches at least one client record. */
    isPortalUser: clients.length > 0,
  }
}
