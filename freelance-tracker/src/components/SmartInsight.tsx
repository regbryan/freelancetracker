import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'
import type { TimeEntry } from '../hooks/useTimeEntries'
import type { Invoice } from '../hooks/useInvoices'

interface SmartInsightProps {
  projects: Project[]
  tasks: Task[]
  entries: TimeEntry[]
  invoices: Invoice[]
}

type Insight = {
  id: string
  message: React.ReactNode
  ctaLabel: string
  ctaTo: string
}

const DISMISSED_KEY = 'smart_insight_dismissed'

function loadDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveDismissed(dismissed: Record<string, number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
  } catch { /* ignore */ }
}

// Dismissals expire after 7 days so new state can resurface insights.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default function SmartInsight({ projects, tasks, entries, invoices }: SmartInsightProps) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => loadDismissed())

  // Clean up stale dismissals on mount
  useEffect(() => {
    const now = Date.now()
    const cleaned = Object.fromEntries(
      Object.entries(dismissed).filter(([, t]) => now - t < DISMISS_TTL_MS)
    )
    if (Object.keys(cleaned).length !== Object.keys(dismissed).length) {
      setDismissed(cleaned)
      saveDismissed(cleaned)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insight = useMemo<Insight | null>(() => {
    const candidates: Insight[] = []

    // 1) Unbilled hours on an active project (≥ 5 hours)
    const unbilledByProject = new Map<string, number>()
    for (const e of entries) {
      if (e.billable && !e.invoice_id) {
        unbilledByProject.set(e.project_id, (unbilledByProject.get(e.project_id) || 0) + e.hours)
      }
    }
    const topUnbilled = [...unbilledByProject.entries()]
      .map(([pid, hours]) => ({ project: projects.find(p => p.id === pid), hours }))
      .filter(x => x.project && x.project.status === 'active' && x.hours >= 5)
      .sort((a, b) => b.hours - a.hours)[0]

    if (topUnbilled?.project) {
      candidates.push({
        id: `unbilled-${topUnbilled.project.id}`,
        message: (
          <>
            You have <strong>{topUnbilled.hours.toFixed(1)} unbilled hours</strong> for{' '}
            <strong>"{topUnbilled.project.name}"</strong> that could be invoiced now. Ready to generate a draft?
          </>
        ),
        ctaLabel: 'Create Draft',
        ctaTo: `/projects/${topUnbilled.project.id}`,
      })
    }

    // 2) Overdue invoices
    const today = new Date().toISOString().slice(0, 10)
    const overdueInvoices = invoices.filter(
      i => (i.status === 'sent' || i.status === 'overdue') && i.due_date && i.due_date < today
    )
    if (overdueInvoices.length > 0) {
      const total = overdueInvoices.reduce((s, i) => s + i.total, 0)
      candidates.push({
        id: `overdue-inv-${overdueInvoices.length}-${total}`,
        message: (
          <>
            You have <strong>{overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}</strong>{' '}
            totaling <strong>${total.toLocaleString()}</strong>. Send a reminder to keep cash flow healthy.
          </>
        ),
        ctaLabel: 'Review Invoices',
        ctaTo: '/invoices',
      })
    }

    // 3) Overdue tasks
    const overdueTasks = tasks.filter(
      t => t.status !== 'done' && t.due_date && t.due_date < today
    )
    if (overdueTasks.length >= 3) {
      candidates.push({
        id: `overdue-tasks-${overdueTasks.length}`,
        message: (
          <>
            <strong>{overdueTasks.length} tasks</strong> are past due. A quick review will keep projects on track.
          </>
        ),
        ctaLabel: 'Review Tasks',
        ctaTo: '/tasks',
      })
    }

    // 4) Stale projects (active, no time logged in 14+ days)
    if (candidates.length === 0) {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      const recentProjectIds = new Set(
        entries
          .filter(e => new Date(e.date) >= twoWeeksAgo)
          .map(e => e.project_id)
      )
      const staleActive = projects.filter(p => p.status === 'active' && !recentProjectIds.has(p.id))
      if (staleActive.length > 0) {
        candidates.push({
          id: `stale-${staleActive.length}`,
          message: (
            <>
              <strong>{staleActive.length} active project{staleActive.length > 1 ? 's have' : ' has'}</strong> no time logged in the last 2 weeks. Time to re-engage or mark as on-hold?
            </>
          ),
          ctaLabel: 'View Projects',
          ctaTo: '/projects',
        })
      }
    }

    // Return first insight not dismissed
    const now = Date.now()
    return candidates.find(c => {
      const dismissedAt = dismissed[c.id]
      return !dismissedAt || now - dismissedAt >= DISMISS_TTL_MS
    }) ?? null
  }, [projects, tasks, entries, invoices, dismissed])

  if (!insight) return null

  const handleDismiss = () => {
    const next = { ...dismissed, [insight.id]: Date.now() }
    setDismissed(next)
    saveDismissed(next)
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border shadow-card"
      style={{
        background: 'linear-gradient(135deg, #f5f8ff 0%, #eff6ff 100%)',
        borderColor: '#c7dafd',
      }}
    >
      <div className="flex items-start gap-4 p-5 flex-wrap md:flex-nowrap">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white shadow-button"
          style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
        >
          <Sparkles size={18} />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-accent text-[10px] font-bold uppercase tracking-wider">Smart Insight</p>
          <p className="text-text-primary text-[13px] mt-1 leading-relaxed">
            {insight.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 mt-1 md:mt-0">
          <button
            onClick={handleDismiss}
            className="h-8 px-3 rounded-lg text-text-secondary text-[12px] font-semibold hover:bg-white/70 transition-colors flex items-center gap-1"
          >
            <X size={12} />
            Dismiss
          </button>
          <button
            onClick={() => navigate(insight.ctaTo)}
            className="h-8 px-3.5 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-opacity active:scale-[0.98] shadow-button"
            style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
          >
            {insight.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
