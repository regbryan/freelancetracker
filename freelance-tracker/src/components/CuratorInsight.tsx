import { useMemo } from 'react'
import { Compass } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { TimeEntry } from '../hooks/useTimeEntries'
import InsightBanner from './InsightBanner'
import { useI18n } from '../lib/i18n'

interface CuratorInsightProps {
  projects: Project[]
  entries: TimeEntry[]
}

type Insight = {
  message: React.ReactNode
  cta?: { label: string; to: string }
}

const DAY_KEYS = ['curator.sunday', 'curator.monday', 'curator.tuesday', 'curator.wednesday', 'curator.thursday', 'curator.friday', 'curator.saturday']

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
  const { t } = useI18n()
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
                {t('curator.ratioUp')} <strong>{t('curator.upPct', { pct })}</strong>{t('curator.ratioUpTail', { cur: Math.round(curRatio * 100), last: Math.round(lastRatio * 100) })}
              </>
            ),
          }
        } else {
          return {
            message: (
              <>
                {t('curator.ratioDown')} <strong>{t('curator.downPct', { pct })}</strong>{t('curator.ratioDownTail')}
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
              {t('curator.mostProductivePre')} <strong>{t(DAY_KEYS[topIdx])}</strong>{t('curator.mostProductiveMid')}{' '}
              <strong>{t('curator.hoursShort', { h: avgByDay[topIdx].toFixed(1) })}</strong>{t('curator.aboveAvgTail', { pct: pctAboveAvg })}
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
            {t('curator.stalePre')} <strong>"{stale.name}"</strong>{t('curator.staleTail')}
          </>
        ),
        cta: { label: t('curator.viewProject'), to: `/projects/${stale.id}` },
      }
    }

    return null
  }, [projects, entries, t])

  if (!insight) return null

  return (
    <InsightBanner
      label={t('curator.label')}
      variant="curator"
      icon={Compass}
      message={insight.message}
      cta={insight.cta}
    />
  )
}
