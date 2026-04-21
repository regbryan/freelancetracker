import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import type { Task } from '../hooks/useTasks'
import InsightBanner from './InsightBanner'
import { useI18n } from '../lib/i18n'

interface TaskInsightProps {
  tasks: Task[]
}

type Insight = {
  message: React.ReactNode
  cta?: { label: string; to: string }
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + (aIso.length === 10 ? 'T00:00:00' : ''))
  const b = new Date(bIso + (bIso.length === 10 ? 'T00:00:00' : ''))
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export default function TaskInsight({ tasks }: TaskInsightProps) {
  const { t } = useI18n()
  const insight = useMemo<Insight | null>(() => {
    const today = new Date().toISOString().slice(0, 10)

    // 1) Overdue tasks (due before today, not done)
    const overdue = tasks.filter(
      tk => tk.status !== 'done' && tk.due_date && tk.due_date < today,
    )
    if (overdue.length > 0) {
      const worstDays = Math.max(
        ...overdue.map(tk => daysBetween(tk.due_date!, today)),
      )
      const countKey = overdue.length === 1 ? 'taskInsight.taskCount' : 'taskInsight.taskCountPlural'
      const daysKey = worstDays === 1 ? 'taskInsight.overdueDays' : 'taskInsight.overdueDaysPlural'
      return {
        message: (
          <>
            <strong>{t(countKey, { n: overdue.length })}</strong>{' '}
            {overdue.length === 1 ? t('taskInsight.isPastDue') : t('taskInsight.arePastDue')} {t('taskInsight.overdueMid')}{' '}
            <strong>{t(daysKey, { n: worstDays })}</strong>{t('taskInsight.overdueTail')}
          </>
        ),
      }
    }

    // 2) High WIP — too many in-progress
    const inProgress = tasks.filter(tk => tk.status === 'in_progress')
    if (inProgress.length >= 5) {
      return {
        message: (
          <>
            {t('taskInsight.highWipPre')} <strong>{t('taskInsight.inProgressCount', { n: inProgress.length })}</strong>{t('taskInsight.highWipTail')}
          </>
        ),
      }
    }

    // 3) Stale in-progress (not touched in 14+ days)
    const stale = inProgress.filter(
      tk => tk.updated_at && daysBetween(tk.updated_at.slice(0, 10), today) >= 14,
    )
    if (stale.length > 0) {
      const oldest = stale[0]
      const staleDays = daysBetween(oldest.updated_at.slice(0, 10), today)
      return {
        message: (
          <>
            <strong>"{oldest.title}"</strong> {t('taskInsight.staleMid')}{' '}
            <strong>{t('taskInsight.staleDays', { n: staleDays })}</strong>{t('taskInsight.staleTail')}
          </>
        ),
      }
    }

    // 4) Baseline — completion pace
    const done = tasks.filter(tk => tk.status === 'done')
    const total = tasks.length
    if (total >= 5 && done.length > 0) {
      const pct = Math.round((done.length / total) * 100)
      if (pct >= 70) {
        return {
          message: (
            <>
              {t('taskInsight.closedPre')} <strong>{t('taskInsight.closedPct', { pct })}</strong> {t('taskInsight.closedMid', { done: done.length, total })}{t('taskInsight.closedTail')}
            </>
          ),
        }
      }
    }

    return null
  }, [tasks, t])

  if (!insight) return null

  return (
    <InsightBanner
      label={t('taskInsight.label')}
      variant="smart"
      icon={ListChecks}
      message={insight.message}
      cta={insight.cta}
    />
  )
}
