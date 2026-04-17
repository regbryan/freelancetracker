import { useMemo } from 'react'
import { Compass } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { TimeEntry } from '../hooks/useTimeEntries'
import InsightBanner from './InsightBanner'

interface CuratorInsightProps {
  projects: Project[]
  entries: TimeEntry[]
}

type Insight = {
  message: React.ReactNode
  cta?: { label: string; to: string }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function sameIsoWeek(d: Date, ref: Date): boolean {
  const refMonday = new Date(ref)
  const day = refMonday.getDay() || 7 // Sun=7
  refMonday.setDate(refMonday.getDate() - (day - 1))
  refMonday.setHours(0, 0, 0, 0)
  const refSunday = new Date(refMonday)
  refSunday.setDate(refSunday.getDate() + 7)
  return d >= refMonday && d < refSunday
}

export default function CuratorInsight({ projects, entries }: CuratorInsightProps) {
  const insight = useMemo<Insight | null>(() => {
    const now = new Date()

    // Partition entries into this-week and last-week for billable-ratio comparison
    const thisWeek: TimeEntry[] = []
    const lastWeek: TimeEntry[] = []
    const lastWeekRef = new Date(now)
    lastWeekRef.setDate(lastWeekRef.getDate() - 7)

    for (const e of entries) {
      const d = new Date(e.date)
      if (sameIsoWeek(d, now)) thisWeek.push(e)
      else if (sameIsoWeek(d, lastWeekRef)) lastWeek.push(e)
    }

    const billable = (arr: TimeEntry[]) =>
      arr.filter(e => e.billable).reduce((s, e) => s + e.hours, 0)
    const total = (arr: TimeEntry[]) => arr.reduce((s, e) => s + e.hours, 0)

    // 1) Billable ratio trend (this week vs last week)
    if (thisWeek.length >= 3 && lastWeek.length >= 3) {
      const curTotal = total(thisWeek)
      const lastTotal = total(lastWeek)
      const curRatio = curTotal > 0 ? billable(thisWeek) / curTotal : 0
      const lastRatio = lastTotal > 0 ? billable(lastWeek) / lastTotal : 0
      const diff = curRatio - lastRatio

      if (Math.abs(diff) >= 0.1) {
        const pct = Math.abs(Math.round(diff * 100))
        if (diff > 0) {
          return {
            message: (
              <>
                Your billable ratio is <strong>up {pct}%</strong> vs last week
                ({Math.round(curRatio * 100)}% vs {Math.round(lastRatio * 100)}%). Momentum is compounding — lock the cadence.
              </>
            ),
          }
        } else {
          return {
            message: (
              <>
                Your billable ratio is <strong>down {pct}%</strong> vs last week.
                If the drop is intentional (admin, learning), fine — if not, re-center on paying work.
              </>
            ),
          }
        }
      }
    }

    // 2) Most productive day-of-week pattern (last 30 days, needs ≥ 5 distinct days)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dayHours = [0, 0, 0, 0, 0, 0, 0]
    const dayCount = [0, 0, 0, 0, 0, 0, 0]
    const seenDates = new Set<string>()
    for (const e of entries) {
      const d = new Date(e.date)
      if (d < thirtyDaysAgo) continue
      const dow = d.getDay()
      dayHours[dow] += e.hours
      if (!seenDates.has(e.date)) {
        seenDates.add(e.date)
        dayCount[dow] += 1
      }
    }
    const avgByDay = dayHours.map((h, i) => (dayCount[i] > 0 ? h / dayCount[i] : 0))
    const totalAvg = avgByDay.reduce((s, x) => s + x, 0) / 7

    if (seenDates.size >= 5 && totalAvg > 0) {
      let topIdx = 0
      for (let i = 1; i < 7; i++) if (avgByDay[i] > avgByDay[topIdx]) topIdx = i
      const pctAboveAvg = Math.round(((avgByDay[topIdx] - totalAvg) / totalAvg) * 100)
      if (pctAboveAvg >= 20 && avgByDay[topIdx] >= 2) {
        return {
          message: (
            <>
              Your most productive day is <strong>{DAY_NAMES[topIdx]}</strong> — averaging{' '}
              <strong>{avgByDay[topIdx].toFixed(1)}h</strong>, {pctAboveAvg}% above your weekly average.
              Protect it for deep work.
            </>
          ),
        }
      }
    }

    // 3) Active project with no hours this week
    const thisWeekProjectIds = new Set(thisWeek.map(e => e.project_id))
    const stale = projects.find(
      p => p.status === 'active' && !thisWeekProjectIds.has(p.id)
    )
    if (stale) {
      return {
        message: (
          <>
            You haven't logged any time on <strong>"{stale.name}"</strong> this week.
            A 30-minute block keeps the project warm and clients reassured.
          </>
        ),
        cta: { label: 'View Project', to: `/projects/${stale.id}` },
      }
    }

    return null
  }, [projects, entries])

  if (!insight) return null

  return (
    <InsightBanner
      label="Curator's Insight"
      variant="curator"
      icon={Compass}
      message={insight.message}
      cta={insight.cta}
    />
  )
}
