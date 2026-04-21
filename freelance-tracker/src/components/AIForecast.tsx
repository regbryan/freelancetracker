import { useMemo } from 'react'
import { Brain } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'
import type { TimeEntry } from '../hooks/useTimeEntries'
import InsightBanner from './InsightBanner'
import { useI18n } from '../lib/i18n'

interface AIForecastProps {
  projects: Project[]
  tasks: Task[]
  entries: TimeEntry[]
}

function ConfidenceRing({ score }: { score: number }) {
  const { t } = useI18n()
  const size = 56
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#15263a"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[#15263a] text-[13px] font-bold">{score}%</span>
        </div>
      </div>
      <p className="text-[#15263a] text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">
        {t('aiForecast.confidence')}
      </p>
    </div>
  )
}

export default function AIForecast({ projects, tasks, entries }: AIForecastProps) {
  const { t } = useI18n()
  const forecast = useMemo(() => {
    const now = new Date()

    // Find the soonest active project with an end_date
    const candidates = projects
      .filter(p => p.status === 'active' && p.end_date)
      .map(p => ({ project: p, end: new Date(p.end_date!) }))
      .filter(({ end }) => end >= now)
      .sort((a, b) => a.end.getTime() - b.end.getTime())

    if (candidates.length === 0) return null

    const { project, end } = candidates[0]
    const start = project.start_date
      ? new Date(project.start_date)
      : new Date(project.created_at)

    const projectTasks = tasks.filter(t => t.project_id === project.id)
    const doneTasks = projectTasks.filter(t => t.status === 'done').length
    const totalTasks = projectTasks.length

    if (totalTasks === 0) return null

    const totalMs = end.getTime() - start.getTime()
    const elapsedMs = now.getTime() - start.getTime()
    if (totalMs <= 0) return null

    const timePct = Math.max(0, Math.min(1, elapsedMs / totalMs))
    const taskPct = doneTasks / totalTasks

    // Extrapolate completion: if we're X% done in Y elapsed time,
    // total time needed = elapsed / taskPct; projected end = start + totalNeeded
    let projectedEnd: Date
    if (taskPct === 0) {
      projectedEnd = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days late as fallback
    } else {
      const totalNeeded = elapsedMs / taskPct
      projectedEnd = new Date(start.getTime() + totalNeeded)
    }

    const diffDays = Math.round((end.getTime() - projectedEnd.getTime()) / (1000 * 60 * 60 * 24))

    // Confidence: more tasks + recent activity + some time elapsed = higher confidence
    const recentEntries = entries.filter(e => {
      const d = new Date(e.date)
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      return e.project_id === project.id && diff <= 14
    }).length

    let confidence = 50
    if (totalTasks >= 10) confidence += 20
    else if (totalTasks >= 5) confidence += 10
    if (recentEntries >= 5) confidence += 20
    else if (recentEntries >= 2) confidence += 10
    if (timePct > 0.2) confidence += 10
    confidence = Math.min(95, confidence)

    let verdict: 'early' | 'late' | 'ontrack'
    let days = Math.abs(diffDays)
    if (diffDays >= 2) verdict = 'early'
    else if (diffDays <= -2) verdict = 'late'
    else {
      verdict = 'ontrack'
      days = 0
    }

    return { project, verdict, days, confidence }
  }, [projects, tasks, entries])

  if (!forecast) return null

  const { project, verdict, days, confidence } = forecast

  const message =
    verdict === 'early' ? (
      <>
        <strong>"{project.name}"</strong> {t('aiForecast.early')}{' '}
        <strong>{days === 1 ? t('aiForecast.daysEarly', { n: days }) : t('aiForecast.daysEarlyPlural', { n: days })}</strong>{t('aiForecast.earlyTail')}
      </>
    ) : verdict === 'late' ? (
      <>
        <strong>"{project.name}"</strong> {t('aiForecast.late')}{' '}
        <strong>{days === 1 ? t('aiForecast.daysBehind', { n: days }) : t('aiForecast.daysBehindPlural', { n: days })}</strong>{t('aiForecast.lateTail')}
      </>
    ) : (
      <>
        <strong>"{project.name}"</strong> {t('aiForecast.onTrack')} <strong>{t('aiForecast.onSchedule')}</strong>{t('aiForecast.onTrackTail')}
      </>
    )

  return (
    <InsightBanner
      label={t('aiForecast.label')}
      variant="forecast"
      icon={Brain}
      message={message}
      accessory={<ConfidenceRing score={confidence} />}
      cta={{ label: t('aiForecast.viewProject'), to: `/projects/${project.id}` }}
    />
  )
}
