import { useMemo } from 'react'
import { CalendarClock } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'
import InsightBanner from './InsightBanner'

interface TimelineInsightProps {
  projects: Project[]
  tasks: Task[]
}

type Insight = { message: React.ReactNode }

function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((parseDate(iso).getTime() - today.getTime()) / 86400000)
}

function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const s = Math.max(parseDate(aStart).getTime(), parseDate(bStart).getTime())
  const e = Math.min(parseDate(aEnd).getTime(), parseDate(bEnd).getTime())
  return Math.max(0, Math.round((e - s) / 86400000))
}

export default function TimelineInsight({ projects, tasks }: TimelineInsightProps) {
  const insight = useMemo<Insight | null>(() => {
    const active = projects.filter(
      p => p.status === 'active' && p.start_date && p.end_date,
    )

    // 1) Project pileup — 2+ active projects ending within 7 days of each other
    const endingSoon = active
      .filter(p => {
        const d = daysUntil(p.end_date!)
        return d >= 0 && d <= 21
      })
      .sort((a, b) => a.end_date!.localeCompare(b.end_date!))

    if (endingSoon.length >= 2) {
      const firstEnd = daysUntil(endingSoon[0].end_date!)
      const lastEnd = daysUntil(endingSoon[endingSoon.length - 1].end_date!)
      if (lastEnd - firstEnd <= 7) {
        return {
          message: (
            <>
              <strong>{endingSoon.length} active projects</strong> land within a{' '}
              <strong>{Math.max(1, lastEnd - firstEnd)}-day</strong> window — starting in{' '}
              <strong>{Math.max(0, firstEnd)} day{firstEnd === 1 ? '' : 's'}</strong>.
              Plan the handoff sequence before the crunch hits.
            </>
          ),
        }
      }
    }

    // 2) Heavy overlap — any pair of active projects overlapping 14+ days
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]
        const b = active[j]
        const d = overlapDays(a.start_date!, a.end_date!, b.start_date!, b.end_date!)
        if (d >= 14) {
          return {
            message: (
              <>
                <strong>"{a.name}"</strong> and <strong>"{b.name}"</strong> overlap by{' '}
                <strong>{d} days</strong>. Double-book your calendar intentionally —
                or negotiate one of them.
              </>
            ),
          }
        }
      }
    }

    // 3) Runway — nearest deadline in <14 days
    const nearest = active
      .map(p => ({ project: p, days: daysUntil(p.end_date!) }))
      .filter(({ days }) => days >= 0 && days <= 14)
      .sort((a, b) => a.days - b.days)[0]

    if (nearest) {
      const taskCount = tasks.filter(
        t => t.project_id === nearest.project.id && t.status !== 'done',
      ).length
      return {
        message: (
          <>
            <strong>"{nearest.project.name}"</strong> wraps in{' '}
            <strong>{nearest.days} day{nearest.days === 1 ? '' : 's'}</strong>
            {taskCount > 0 ? (
              <>
                {' '}with <strong>{taskCount} open task{taskCount === 1 ? '' : 's'}</strong>.
                The last week decides the perception.
              </>
            ) : (
              <>. Clear runway — protect it from surprise scope.</>
            )}
          </>
        ),
      }
    }

    // 4) Baseline — many parallel tracks
    if (active.length >= 3) {
      return {
        message: (
          <>
            <strong>{active.length} concurrent projects</strong> on the runway. The Gantt
            view below shows where they thin out — aim your energy at the narrow weeks.
          </>
        ),
      }
    }

    return null
  }, [projects, tasks])

  if (!insight) return null

  return (
    <InsightBanner
      label="Runway View"
      variant="forecast"
      icon={CalendarClock}
      message={insight.message}
    />
  )
}
