import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useWorkspaceRole, isCollaboratorPath, WorkspaceRoleContext } from '../hooks/useWorkspaceRole'

/**
 * Classifies the signed-in user and shapes the app around it:
 * - portal      → client; sent to /portal
 * - collaborator → invited on some projects; only /timeline and /tasks
 * - owner       → the freelancer; everything
 * The role is provided via context so Sidebar, WorkTabs, Layout, and pages can adapt.
 */
export default function OwnerGate({ children }: { children: ReactNode }) {
  const { role, loading } = useWorkspaceRole()
  const location = useLocation()

  if (loading || role === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }
  if (role === 'portal') return <Navigate to="/portal" replace />
  if (role === 'collaborator' && !isCollaboratorPath(location.pathname)) {
    return <Navigate to="/timeline" replace />
  }
  return <WorkspaceRoleContext.Provider value={role}>{children}</WorkspaceRoleContext.Provider>
}
