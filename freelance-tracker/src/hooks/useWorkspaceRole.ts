import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type WorkspaceRole = 'owner' | 'collaborator' | 'portal'

/** Routes a collaborator may open. Everything else redirects to /timeline. */
export const COLLABORATOR_PATHS = ['/timeline', '/tasks'] as const

export function isCollaboratorPath(pathname: string): boolean {
  return COLLABORATOR_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
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

/**
 * Provided by OwnerGate once the role is known. Deliberately has no default —
 * a component that reads the role outside the gate should fail loudly rather
 * than silently behave as an owner.
 */
export const WorkspaceRoleContext = createContext<WorkspaceRole | null>(null)

/** Read the role provided by OwnerGate. Throws outside the gate — portal pages never call this. */
export function useRole(): WorkspaceRole {
  const role = useContext(WorkspaceRoleContext)
  if (role === null) throw new Error('useRole must be used inside OwnerGate')
  return role
}

type MembershipTable = 'clients' | 'project_members' | 'portal_clients'

/**
 * True if the query returns at least one row for the signed-in user. An
 * optional column/value filter scopes the query to the caller's own rows
 * (needed for project_members, where RLS also lets an owner see rows for
 * projects they own — an unfiltered count would misclassify them).
 * PGRST205 ("table not found") is expected until the project_members
 * migration runs, so it's swallowed silently; any other error is logged.
 */
async function hasRows(table: MembershipTable, filter?: { column: string; value: string }): Promise<boolean> {
  let query = supabase.from(table).select('id').limit(1)
  if (filter) query = query.eq(filter.column, filter.value)
  const { data, error } = await query
  if (error) {
    if (error.code !== 'PGRST205') {
      console.warn('[useWorkspaceRole]', table, error.message)
    }
    return false
  }
  return (data?.length ?? 0) > 0
}

/** Runs the membership queries and classifies the current user by their (already known) email. */
async function classify(email: string): Promise<WorkspaceRole> {
  const [owns, member, portal] = await Promise.all([
    hasRows('clients'),
    email ? hasRows('project_members', { column: 'email', value: email }) : Promise.resolve(false),
    hasRows('portal_clients'),
  ])
  return resolveRole(owns, member, portal)
}

type Identity = { id: string; email: string } | null

function toIdentity(user: { id: string; email?: string } | null | undefined): Identity {
  return user ? { id: user.id, email: (user.email ?? '').toLowerCase() } : null
}

/**
 * Classifies the signed-in user as owner/collaborator/portal, and
 * re-classifies whenever the signed-in user changes (cross-tab sign-in as
 * someone else, USER_UPDATED) without requiring a remount. Classification
 * runs exactly once per distinct user id — a token refresh or any other
 * auth event that reports the same id does not re-trigger it, so OwnerGate
 * never drops back to its spinner (and remounts Layout) for no reason.
 */
export function useWorkspaceRole(): { role: WorkspaceRole | null; loading: boolean } {
  const [role, setRole] = useState<WorkspaceRole | null>(null)
  const [identity, setIdentity] = useState<Identity>(null)

  // Track the signed-in user's id/email so the classification effect below
  // can run once we know who's signed in, and re-run when that changes.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setIdentity(toIdentity(data.user))
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIdentity(toIdentity(session?.user))
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (identity === null) return
    let cancelled = false
    setRole(null)
    classify(identity.email).then((resolved) => {
      if (!cancelled) setRole(resolved)
    })
    return () => {
      cancelled = true
    }
    // Re-run only when the user id itself changes, not on every identity
    // object (e.g. a token-refresh auth event for the same user).
  }, [identity?.id])

  return { role, loading: role === null }
}
