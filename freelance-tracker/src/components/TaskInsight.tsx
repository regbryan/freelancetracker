import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import type { Task } from '../hooks/useTasks'
import InsightBanner from './InsightBanner'

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
  const insight = useMemo<Insight | null>(() => {
    const today = new Date().toISOString().slice(0, 10)

    // 1) Overdue tasks (due before today, not done)
    const overdue = tasks.filter(
      t => t.status !== 'done' && t.due_date && t.due_date < today,
    )
    if (overdue.length > 0) {
      const worstDays = Math.max(
        ...overdue.map(t => daysBetween(t.due_date!, today)),
      )
      return {
        message: (
          <>
            <strong>
              {overdue.length} task{overdue.length > 1 ? 's' : ''}
            </strong>{' '}
            {overdue.length === 1 ? 'is' : 'are'} past due — the oldest by{' '}
            <strong>{worstDays} day{worstDays > 1 ? 's' : ''}</strong>.
            Reschedule or close them out so your list reflects reality.
          </>
        ),
      }
    }

    // 2) High WIP — too many in-progress
    const inProgress = tasks.filter(t => t.status === 'in_progress')
    if (inProgress.length >= 5) {
      return {
        message: (
          <>
            You have <strong>{inProgress.length} tasks in progress</strong> at once.
            Finishing beats starting — pick the top two and push them to done first.
          </>
        ),
      }
    }

    // 3) Stale in-progress (not touched in 14+ days)
    const stale = inProgress.filter(
      t => t.updated_at && daysBetween(t.updated_at.slice(0, 10), today) >= 14,
    )
    if (stale.length > 0) {
      const oldest = stale[0]
      const staleDays = daysBetween(oldest.updated_at.slice(0, 10), today)
      return {
        message: (
          <>
            <strong>"{oldest.title}"</strong> has been in progress for{' '}
            <strong>{staleDays} days</strong>. Either ship it, split it, or send it back to todo.
          </>
        ),
      }
    }

    // 4) Baseline — completion pace
    const done = tasks.filter(t => t.status === 'done')
    const total = tasks.length
    if (total >= 5 && done.length > 0) {
      const pct = Math.round((done.length / total) * 100)
      if (pct >= 70) {
        return {
          message: (
            <>
              You've closed <strong>{pct}%</strong> of your tasks ({done.length} of {total}).
              The finish line is the easiest stretch to coast through — don't.
            </>
          ),
        }
      }
    }

    return null
  }, [tasks])

  if (!insight) return null

  return (
    <InsightBanner
      label="Task Focus"
      variant="smart"
      icon={ListChecks}
      message={insight.message}
      cta={insight.cta}
    />
  )
}
