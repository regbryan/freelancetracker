import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type WorkspaceRole = 'owner' | 'collaborator' | 'portal'

/** Routes a collaborator may open. Everything else redirects to /timeline. */
export const COLLABORATOR_PATHS = ['/timeline', '/tasks'] as const

export function isCollaboratorPath(pathname: string): boolean {
  return COLLABORATOR_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

/**
 * Pure classifier. Owner wins because the RLS scoping for owned data is by
 * user_id; a member with no clients is a collaborator; a portal-only email is
 * a client; an account with nothing yet is a fresh freelancer signup.
 */
export function resolveRole(ownsClients: boolean, isMember: boolean, isPortalClient: boolean): WorkspaceRole {
  if (ownsClients) return 'owner'
  if (isMember) return 'collaborator'
  if (isPortalClient) return 'portal'
  return 'owner'
}

export const WorkspaceRoleContext = createContext<WorkspaceRole>('owner')

/** Read the role provided by OwnerGate. Defaults to 'owner' outside the gate (portal pages never call this). */
export function useRole(): WorkspaceRole {
  return useContext(WorkspaceRoleContext)
}

async function hasRows(table: string): Promise<boolean> {
  const { count, error } = await supabase.from(table).select('id', { head: true, count: 'exact' }).limit(1)
  if (error) return false
  return (count ?? 0) > 0
}

/** Runs the three head-count queries once per session and classifies the user. */
export function useWorkspaceRole(): { role: WorkspaceRole | null; loading: boolean } {
  const [role, setRole] = useState<WorkspaceRole | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([hasRows('clients'), hasRows('project_members'), hasRows('portal_clients')])
      .then(([owns, member, portal]) => {
        if (!cancelled) setRole(resolveRole(owns, member, portal))
      })
      .catch(() => {
        if (!cancelled) setRole('owner')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { role, loading: role === null }
}
