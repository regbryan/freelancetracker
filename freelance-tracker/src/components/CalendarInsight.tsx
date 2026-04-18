import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import InsightBanner from './InsightBanner'

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

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function durationHours(start: string, end: string): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000)
}

export default function CalendarInsight({ events, currentDate }: CalendarInsightProps) {
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
            <strong>{todayEvents.length} meetings today</strong> totaling{' '}
            <strong>{hours.toFixed(1)} hours</strong>. Protect the gaps —
            they're where the actual work happens.
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
        ? 'today'
        : isTomorrow
          ? 'tomorrow'
          : WEEKDAY[quietDay.getDay()]
      return {
        message: (
          <>
            <strong>No meetings {label}</strong> — a full block for deep work.
            Protect it before someone books over it.
          </>
        ),
      }
    }

    // 3) Heavy week — 15+ events across the work week
    if (weekEvents.length >= 15) {
      return {
        message: (
          <>
            <strong>{weekEvents.length} meetings</strong> across this work week.
            Block a "no meetings" slot now before the week closes itself in.
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
      return {
        message: (
          <>
            <strong>{upcomingWeek}</strong> meeting{upcomingWeek === 1 ? '' : 's'} left this work week.
            Viewing <strong>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>.
          </>
        ),
      }
    }

    return null
  }, [events, currentDate])

  if (!insight) return null

  return (
    <InsightBanner
      label="Schedule Read"
      variant="smart"
      icon={CalendarDays}
      message={insight.message}
    />
  )
}
