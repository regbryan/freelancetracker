import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * Keeps portal-only users out of the freelancer app. A signed-in user who owns
 * no clients rows (base table is owner-scoped by RLS) but matches portal_clients
 * is a client — send them to /portal. Everyone else (owners, brand-new
 * freelancer accounts) passes through.
 */
export default function OwnerGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'owner' | 'portal'>('checking')

  useEffect(() => {
    let cancelled = false
    async function check() {
      const [owned, portal] = await Promise.all([
        supabase.from('clients').select('id', { head: true, count: 'exact' }).limit(1),
        supabase.from('portal_clients').select('id', { head: true, count: 'exact' }).limit(1),
      ])
      if (cancelled) return
      const ownsRows = (owned.count ?? 0) > 0
      const isPortal = (portal.count ?? 0) > 0
      setState(!ownsRows && isPortal ? 'portal' : 'owner')
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }
  if (state === 'portal') return <Navigate to="/portal" replace />
  return <>{children}</>
}
