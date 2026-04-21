import { useMemo, useState, useEffect } from 'react'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'
import type { TimeEntry } from '../hooks/useTimeEntries'
import type { Invoice } from '../hooks/useInvoices'
import InsightBanner from './InsightBanner'
import { useI18n } from '../lib/i18n'

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
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => loadDismissed())

  // Clean up stale dismissals on mount
  useEffect(() => {
    const now = Date.now()
    const cleaned = Object.fromEntries(
      Object.entries(dismissed).filter(([, at]) => now - at < DISMISS_TTL_MS)
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
            {t('smart.unbilledHours')} <strong>{t('smart.hoursForProject', { h: topUnbilled.hours.toFixed(1) })}</strong>{' '}
            <strong>"{topUnbilled.project.name}"</strong> {t('smart.unbilledTail')}
          </>
        ),
        ctaLabel: t('smart.createDraft'),
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
      const countKey = overdueInvoices.length === 1 ? 'smart.invoicesCount' : 'smart.invoicesCountPlural'
      candidates.push({
        id: `overdue-inv-${overdueInvoices.length}-${total}`,
        message: (
          <>
            {t('smart.overdueInvoices')} <strong>{t(countKey, { n: overdueInvoices.length })}</strong>{' '}
            {t('smart.totaling')} <strong>${total.toLocaleString()}</strong>{t('smart.overdueTail')}
          </>
        ),
        ctaLabel: t('smart.reviewInvoices'),
        ctaTo: '/invoices',
      })
    }

    // 3) Overdue tasks
    const overdueTasks = tasks.filter(
      tk => tk.status !== 'done' && tk.due_date && tk.due_date < today
    )
    if (overdueTasks.length >= 3) {
      candidates.push({
        id: `overdue-tasks-${overdueTasks.length}`,
        message: (
          <>
            <strong>{t('smart.tasksPre', { n: overdueTasks.length })}</strong>{t('smart.pastDueTail')}
          </>
        ),
        ctaLabel: t('smart.reviewTasks'),
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
        const staleKey = staleActive.length === 1 ? 'smart.stalePre' : 'smart.stalePrePlural'
        candidates.push({
          id: `stale-${staleActive.length}`,
          message: (
            <>
              <strong>{t(staleKey, { n: staleActive.length })}</strong>{t('smart.staleTail')}
            </>
          ),
          ctaLabel: t('smart.viewProjects'),
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
    <InsightBanner
      label={t('smart.label')}
      variant="smart"
      message={insight.message}
      cta={{ label: insight.ctaLabel, to: insight.ctaTo }}
      onDismiss={handleDismiss}
    />
  )
}
