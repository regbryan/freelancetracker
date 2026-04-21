import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import InsightBanner from './InsightBanner'
import { useI18n } from '../lib/i18n'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
}

interface CalendarInsightProps {
  events: CalendarEvent[]
  currentDate: Date
}

type Insight = { message: React.ReactNode }

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function durationHours(start: string, end: string): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000)
}

export default function CalendarInsight({ events, currentDate }: CalendarInsightProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const insight = useMemo<Insight | null>(() => {
    if (!events.length) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Week window: Mon–Fri starting from today's week
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1) // Monday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 4) // Friday
    weekEnd.setHours(23, 59, 59, 999)

    const todayEvents = events.filter((e) => {
      const start = new Date(e.start)
      return sameDay(start, today) && !e.allDay
    })

    const weekEvents = events.filter((e) => {
      const start = new Date(e.start)
      return start >= weekStart && start <= weekEnd && !e.allDay
    })

    // 1) Today is heavy — 4+ meetings
    if (todayEvents.length >= 4) {
      const hours = todayEvents.reduce((sum, e) => sum + durationHours(e.start, e.end), 0)
      return {
        message: (
          <>
            <strong>{t('calInsight.meetingsToday', { n: todayEvents.length })}</strong> {t('calInsight.totaling')}{' '}
            <strong>{t('calInsight.hours', { n: hours.toFixed(1) })}</strong>{t('calInsight.heavyTail')}
          </>
        ),
      }
    }

    // 2) Quiet day this week — find a weekday (Mon–Fri) with zero meetings that's today or later
    const quietDay = (() => {
      for (let i = 0; i < 5; i++) {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        if (d < today) continue
        const hasEvents = events.some((e) => {
          const s = new Date(e.start)
          return sameDay(s, d) && !e.allDay
        })
        if (!hasEvents) return d
      }
      return null
    })()

    if (quietDay) {
      const isTomorrow = sameDay(quietDay, new Date(today.getTime() + 86400000))
      const label = sameDay(quietDay, today)
        ? t('calInsight.today')
        : isTomorrow
          ? t('calInsight.tomorrow')
          : quietDay.toLocaleDateString(locale, { weekday: 'long' })
      return {
        message: (
          <>
            <strong>{t('calInsight.noMeetings', { when: label })}</strong>{t('calInsight.quietTail')}
          </>
        ),
      }
    }

    // 3) Heavy week — 15+ events across the work week
    if (weekEvents.length >= 15) {
      return {
        message: (
          <>
            <strong>{t('calInsight.weekMeetings', { n: weekEvents.length })}</strong>{t('calInsight.weekTail')}
          </>
        ),
      }
    }

    // 4) Baseline — tell them what's coming
    const upcomingWeek = events.filter((e) => {
      const s = new Date(e.start)
      return s >= today && s <= weekEnd && !e.allDay
    }).length
    if (upcomingWeek > 0) {
      const leftKey = upcomingWeek === 1 ? 'calInsight.upcomingLeft' : 'calInsight.upcomingLeftPlural'
      const monthLabel = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      return {
        message: (
          <>
            {t(leftKey, { n: upcomingWeek })}{' '}
            {t('calInsight.viewing', { month: monthLabel })}
          </>
        ),
      }
    }

    return null
  }, [events, currentDate, t, locale])

  if (!insight) return null

  return (
    <InsightBanner
      label={t('calInsight.label')}
      variant="smart"
      icon={CalendarDays}
      message={insight.message}
    />
  )
}
