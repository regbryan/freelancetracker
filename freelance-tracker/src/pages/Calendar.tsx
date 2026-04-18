import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
  MapPin,
  Clock,
  Eye,
  EyeOff,
  Pencil,
  Check,
  Plus,
  X,
} from 'lucide-react'
import CalendarInsight from '../components/CalendarInsight'

/* ── Types ──────────────────────────────────────────────── */
interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string
  description: string
  source: 'google' | 'microsoft'
  calendarName: string
  color: string
}

interface CalendarInfo {
  key: string
  name: string
  source: 'google' | 'microsoft'
  color: string
  count: number
}

type View = 'month' | 'week' | 'day'

/* ── Helpers ────────────────────────────────────────────── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfWeek(d: Date) {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay())
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function hourLabel(h: number) {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

/* ── Component ──────────────────────────────────────────── */
export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [apiCalendars, setApiCalendars] = useState<{ name: string; source: string; color: string }[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', date: '', startTime: '', endTime: '', description: '', location: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Calendar customizations (persisted in localStorage)
  type CalOverrides = Record<string, { name?: string; color?: string }>
  const [calOverrides, setCalOverrides] = useState<CalOverrides>(() => {
    try {
      const raw = localStorage.getItem('calendar_overrides')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return {}
  })
  const [editingCalKey, setEditingCalKey] = useState<string | null>(null)

  function saveCalOverride(key: string, overrides: { name?: string; color?: string }) {
    setCalOverrides((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...overrides } }
      localStorage.setItem('calendar_overrides', JSON.stringify(next))
      return next
    })
  }

  const apiUrl = import.meta.env.VITE_CALENDAR_API_URL || ''

  /* ── Fetch events ─────────────────────────────────────── */
  const loadEvents = useCallback(async () => {
    if (!apiUrl) {
      setLoading(false)
      setError('Calendar API not configured. Set VITE_CALENDAR_API_URL in your .env file.')
      return
    }

    setLoading(true)
    try {
      const rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      const rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0)
      const res = await fetch(
        `${apiUrl}/api/events?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`
      )
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      const fetched: CalendarEvent[] = data.events || []
      const cals: { name: string; source: string; color: string }[] = data.calendars || []

      setEvents(fetched)
      setApiCalendars(cals)
      setVisibility((prev) => {
        const next = { ...prev }
        // Include all calendars from the API (even those with no events)
        cals.forEach((c) => {
          const key = `${c.source}::${c.name}`
          if (!(key in next)) next[key] = true
        })
        fetched.forEach((e) => {
          const key = `${e.source}::${e.calendarName}`
          if (!(key in next)) next[key] = true
        })
        return next
      })
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, currentDate])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  /* ── Derived data ─────────────────────────────────────── */
  const filtered = useMemo(
    () => events
      .filter((e) => visibility[`${e.source}::${e.calendarName}`] !== false)
      .map((e) => {
        const key = `${e.source}::${e.calendarName}`
        const overrides = calOverrides[key]
        if (overrides?.color) return { ...e, color: overrides.color }
        return e
      }),
    [events, visibility, calOverrides]
  )

  const calendars = useMemo<CalendarInfo[]>(() => {
    const map = new Map<string, CalendarInfo>()
    // Seed with all calendars from API (including those with no events)
    apiCalendars.forEach((c) => {
      const key = `${c.source}::${c.name}`
      const overrides = calOverrides[key]
      if (!map.has(key)) map.set(key, {
        key,
        name: overrides?.name || c.name,
        source: c.source as 'google' | 'microsoft',
        color: overrides?.color || c.color,
        count: 0,
      })
    })
    // Count events per calendar
    events.forEach((e) => {
      const key = `${e.source}::${e.calendarName}`
      const overrides = calOverrides[key]
      if (!map.has(key)) map.set(key, {
        key,
        name: overrides?.name || e.calendarName,
        source: e.source,
        color: overrides?.color || e.color,
        count: 0,
      })
      map.get(key)!.count++
    })
    return Array.from(map.values()).sort((a, b) =>
      a.source !== b.source ? (a.source === 'google' ? -1 : 1) : a.name.localeCompare(b.name)
    )
  }, [events, apiCalendars, calOverrides])

  const eventsOn = useCallback(
    (day: Date) => filtered.filter((e) => isSameDay(new Date(e.start), day)),
    [filtered]
  )

  const eventsAtHour = useCallback(
    (day: Date, h: number) =>
      filtered.filter((e) => {
        const s = new Date(e.start)
        return isSameDay(s, day) && s.getHours() === h && !e.allDay
      }),
    [filtered]
  )

  const allDayOn = useCallback(
    (day: Date) => filtered.filter((e) => isSameDay(new Date(e.start), day) && e.allDay),
    [filtered]
  )

  /* ── Navigation ───────────────────────────────────────── */
  function navigate(dir: number) {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else if (view === 'week') d.setDate(d.getDate() + dir * 7)
      else d.setDate(d.getDate() + dir)
      return d
    })
  }

  const headerLabel = useMemo(() => {
    if (view === 'month') return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const ws = startOfWeek(currentDate)
      const we = addDays(ws, 6)
      return `${ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }, [currentDate, view])

  /* ── Toggle helpers ───────────────────────────────────── */
  function toggleCal(key: string) {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleAll(on: boolean) {
    setVisibility((prev) => {
      const next = { ...prev }
      calendars.forEach((c) => (next[c.key] = on))
      return next
    })
  }

  /* ── Create Event ─────────────────────────────────────── */
  function openCreateModal() {
    const d = currentDate
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setCreateForm({ title: '', date: dateStr, startTime: '09:00', endTime: '10:00', description: '', location: '' })
    setCreateError(null)
    setShowCreateModal(true)
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.title || !createForm.date || !createForm.startTime || !createForm.endTime) return

    setCreating(true)
    setCreateError(null)
    try {
      const start = `${createForm.date}T${createForm.startTime}:00`
      const end = `${createForm.date}T${createForm.endTime}:00`

      const res = await fetch(`${apiUrl}/api/create-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title,
          start,
          end,
          description: createForm.description || undefined,
          location: createForm.location || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`)

      setShowCreateModal(false)
      loadEvents()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  function CreateEventModal() {
    if (!showCreateModal) return null
    return (
      <div
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
        onClick={() => setShowCreateModal(false)}
      >
        <div
          className="bg-surface rounded-2xl shadow-lg p-6 w-[420px] max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-primary text-[16px] font-bold">New Event</h2>
            <button
              onClick={() => setShowCreateModal(false)}
              className="p-1 rounded hover:bg-border transition-colors"
            >
              <X size={16} className="text-text-muted" />
            </button>
          </div>

          <form onSubmit={handleCreateEvent} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-muted">Title <span className="text-negative">*</span></label>
              <input
                type="text"
                required
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Meeting with client"
                className="h-9 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-muted">Date <span className="text-negative">*</span></label>
              <input
                type="date"
                required
                value={createForm.date}
                onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-text-muted">Start Time <span className="text-negative">*</span></label>
                <input
                  type="time"
                  required
                  value={createForm.startTime}
                  onChange={(e) => setCreateForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-text-muted">End Time <span className="text-negative">*</span></label>
                <input
                  type="time"
                  required
                  value={createForm.endTime}
                  onChange={(e) => setCreateForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-muted">Location</label>
              <input
                type="text"
                value={createForm.location}
                onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Office, Zoom link, etc."
                className="h-9 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-muted">Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Notes about the event..."
                rows={3}
                className="px-3 py-2 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              />
            </div>

            {createError && (
              <p className="text-negative text-[12px] bg-negative-bg rounded-lg px-3 py-2">{createError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-input-bg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
              >
                {creating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  /* ── Render helpers ───────────────────────────────────── */
  const today = new Date()

  function EventChip({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event) }}
        className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight truncate cursor-pointer hover:opacity-80 transition-opacity ${compact ? '' : 'mb-0.5'}`}
        style={{ borderLeft: `3px solid ${event.color}`, background: `${event.color}15` }}
      >
        {event.title}
      </button>
    )
  }

  function TimeEvent({ event }: { event: CalendarEvent }) {
    return (
      <button
        onClick={() => setSelectedEvent(event)}
        className="w-full text-left rounded px-2 py-1 text-[12px] mb-1 cursor-pointer hover:opacity-80 transition-opacity"
        style={{ borderLeft: `3px solid ${event.color}`, background: `${event.color}18` }}
      >
        <span className="font-semibold text-text-primary">{event.title}</span>
        <span className="text-text-muted ml-1.5 text-[10px]">{fmtTime(event.start)}</span>
      </button>
    )
  }

  /* ── Month View ───────────────────────────────────────── */
  function MonthView() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const sw = startOfWeek(firstDay)
    const cells = Array.from({ length: 42 }, (_, i) => addDays(sw, i))

    return (
      <div className="flex-1 overflow-auto">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map((d, i) => (
            <div
              key={d}
              className={`px-1 sm:px-2 py-1.5 sm:py-2 text-center text-[9px] sm:text-[11px] font-semibold text-text-muted uppercase tracking-wider ${
                i > 0 ? 'border-l border-border' : ''
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        {/* Date cells – 6 rows of 7 */}
        <div className="grid grid-cols-7 flex-1">
          {cells.map((day, i) => {
            const isToday = isSameDay(day, today)
            const isCurMonth = day.getMonth() === month
            const dayEvents = eventsOn(day)
            const col = i % 7
            return (
              <div
                key={i}
                className={`min-h-[60px] sm:min-h-[100px] border-b border-border p-1 sm:p-1.5 cursor-pointer hover:bg-input-bg/50 transition-colors ${
                  col > 0 ? 'border-l border-border' : ''
                } ${!isCurMonth ? 'opacity-30' : ''} ${isToday ? 'bg-accent/5' : ''}`}
                onClick={() => { setCurrentDate(new Date(day)); setView('day') }}
              >
                <div className="flex items-center justify-center mb-1">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-[11px] sm:text-[13px] rounded-full ${
                      isToday
                        ? 'bg-accent text-white font-bold'
                        : 'text-text-primary font-medium'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <EventChip key={ev.id} event={ev} compact />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-text-muted px-1">+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ── Week View ────────────────────────────────────────── */
  function WeekView() {
    const ws = startOfWeek(currentDate)
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
    const hours = Array.from({ length: 24 }, (_, i) => i)

    return (
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 bg-surface z-10">
          <div className="border-r border-border" />
          {days.map((d, i) => {
            const isToday = isSameDay(d, today)
            return (
              <div key={i} className={`px-2 py-2 text-center ${i < 6 ? 'border-r border-border' : ''} ${isToday ? 'bg-accent/5' : ''}`}>
                <p className={`text-[11px] font-semibold ${isToday ? 'text-accent' : 'text-text-muted'}`}>
                  {DAY_NAMES[d.getDay()]}
                </p>
                <p className={`text-[14px] font-bold ${isToday ? 'text-accent' : 'text-text-primary'}`}>
                  {d.getDate()}
                </p>
                {allDayOn(d).map((ev) => (
                  <EventChip key={ev.id} event={ev} />
                ))}
              </div>
            )
          })}
        </div>

        {/* Time rows */}
        {hours.map((h) => (
          <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[48px] border-b border-border">
            <div className="text-right pr-2 pt-0.5 text-[10px] text-text-muted border-r border-border leading-[48px]">
              {hourLabel(h)}
            </div>
            {days.map((d, i) => (
              <div key={i} className={`p-0.5 min-h-[48px] ${i < 6 ? 'border-r border-border' : ''}`}>
                {eventsAtHour(d, h).map((ev) => (
                  <TimeEvent key={ev.id} event={ev} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  /* ── Day View ─────────────────────────────────────────── */
  function DayView() {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const allDay = allDayOn(currentDate)

    return (
      <div className="flex-1 overflow-auto">
        {allDay.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-input-bg/30">
            <span className="text-[11px] text-text-muted font-medium w-[52px] text-right">All day</span>
            <div className="flex flex-wrap gap-1">
              {allDay.map((ev) => (
                <EventChip key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}
        {hours.map((h) => (
          <div key={h} className="grid grid-cols-[60px_1fr] min-h-[48px] border-b border-border">
            <div className="text-right pr-2 pt-0.5 text-[10px] text-text-muted border-r border-border leading-[48px]">
              {hourLabel(h)}
            </div>
            <div className="p-1 min-h-[48px]">
              {eventsAtHour(currentDate, h).map((ev) => (
                <TimeEvent key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  /* ── Event Detail Modal ───────────────────────────────── */
  function EventModal() {
    if (!selectedEvent) return null
    const ev = selectedEvent
    const isGoogle = ev.source === 'google'

    return (
      <div
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
        onClick={() => setSelectedEvent(null)}
      >
        <div
          className="bg-surface rounded-2xl shadow-lg p-6 w-[420px] max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-text-primary text-[18px] font-bold leading-tight pr-4">{ev.title}</h2>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-text-muted hover:text-text-primary text-[18px] shrink-0"
            >
              &times;
            </button>
          </div>

          <div className="flex flex-col gap-3 text-[13px]">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-muted shrink-0" />
              <span className="text-text-secondary">
                {ev.allDay
                  ? new Date(ev.start).toLocaleDateString()
                  : `${new Date(ev.start).toLocaleString()} – ${new Date(ev.end).toLocaleTimeString()}`}
              </span>
            </div>

            {ev.location && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-text-muted shrink-0" />
                <span className="text-text-secondary">{ev.location}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <CalendarIcon size={14} className="text-text-muted shrink-0" />
              <span
                className="inline-block px-2 py-0.5 rounded text-[12px] font-medium"
                style={{
                  background: isGoogle ? '#E8F5E9' : '#E3F2FD',
                  color: isGoogle ? '#2E7D32' : '#1565C0',
                }}
              >
                {isGoogle ? 'Google' : 'Outlook'} &mdash; {ev.calendarName}
              </span>
            </div>

            {ev.description && (
              <p className="text-text-secondary text-[13px] leading-relaxed whitespace-pre-wrap border-t border-border pt-3 mt-1">
                {ev.description}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── Sidebar (calendar list) ──────────────────────────── */
  function CalendarSidebar() {
    const googleCals = calendars.filter((c) => c.source === 'google')
    const msCals = calendars.filter((c) => c.source === 'microsoft')
    const visCount = calendars.filter((c) => visibility[c.key] !== false).length

    return (
      <div className="hidden lg:block w-[220px] bg-surface border-l border-border p-4 overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-primary text-[13px] font-bold">My Calendars</span>
          <span className="text-text-muted text-[11px]">{visCount}/{calendars.length}</span>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => toggleAll(true)} className="text-accent text-[11px] font-medium hover:underline">
            Show all
          </button>
          <span className="text-border text-[11px]">&middot;</span>
          <button onClick={() => toggleAll(false)} className="text-accent text-[11px] font-medium hover:underline">
            Hide all
          </button>
        </div>

        {googleCals.length > 0 && (
          <CalSection label="Google Calendar" icon="G" iconBg="#34A853" calendars={googleCals} />
        )}
        {msCals.length > 0 && (
          <CalSection label="Outlook" icon="M" iconBg="#0078D4" calendars={msCals} />
        )}
        {calendars.length === 0 && (
          <div className="text-center py-6">
            <CalendarIcon size={20} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-[12px]">No calendars connected.</p>
            <a
              href="/settings"
              className="text-accent text-[11px] font-semibold hover:underline mt-1 inline-block"
            >
              Connect in Settings →
            </a>
          </div>
        )}
      </div>
    )
  }

  const COLOR_PRESETS = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#0078D4', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#6366F1']

  function CalSection({
    label,
    icon,
    iconBg,
    calendars: cals,
  }: {
    label: string
    icon: string
    iconBg: string
    calendars: CalendarInfo[]
  }) {
    const visCount = cals.filter((c) => visibility[c.key] !== false).length
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center shrink-0"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          <span className="text-text-primary text-[12px] font-semibold flex-1">{label}</span>
          <span className="text-text-muted text-[10px]">{visCount}/{cals.length}</span>
        </div>
        {cals.map((c) => {
          const on = visibility[c.key] !== false
          const isEditing = editingCalKey === c.key
          return (
            <div key={c.key}>
              <div className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-input-bg transition-colors group">
                <button
                  onClick={() => toggleCal(c.key)}
                  className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0 text-[10px] font-bold"
                  style={{
                    background: on ? c.color : 'transparent',
                    border: `2px solid ${c.color}`,
                    color: on ? '#fff' : 'transparent',
                  }}
                >
                  {on ? '✓' : ''}
                </button>
                <button
                  onClick={() => toggleCal(c.key)}
                  className="text-text-primary text-[12px] flex-1 truncate text-left"
                >
                  {c.name}
                </button>
                <button
                  onClick={() => setEditingCalKey(isEditing ? null : c.key)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-border transition-all shrink-0"
                  title="Edit calendar"
                >
                  {isEditing ? <Check size={10} className="text-accent" /> : <Pencil size={10} className="text-text-muted" />}
                </button>
                <span className="text-text-muted text-[10px] bg-input-bg px-1.5 py-0.5 rounded-full">{c.count}</span>
              </div>

              {/* Inline edit panel */}
              {isEditing && (
                <div className="mx-2 mb-2 p-2.5 bg-input-bg/60 rounded-lg flex flex-col gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Display Name</label>
                    <input
                      type="text"
                      defaultValue={c.name}
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (val && val !== c.name) saveCalOverride(c.key, { name: val })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim()
                          if (val) saveCalOverride(c.key, { name: val })
                          setEditingCalKey(null)
                        }
                      }}
                      className="w-full mt-1 h-7 px-2 bg-surface rounded text-[11px] text-text-primary border border-border outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Color</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() => saveCalOverride(c.key, { color })}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            background: color,
                            borderColor: c.color === color ? '#fff' : color,
                            boxShadow: c.color === color ? `0 0 0 2px ${color}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  /* ── Hero stats ───────────────────────────────────────── */
  const heroStats = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = events.filter((e) => {
      const s = new Date(e.start)
      return s.getFullYear() === today.getFullYear() && s.getMonth() === today.getMonth() && s.getDate() === today.getDate() && !e.allDay
    }).length
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 4)
    weekEnd.setHours(23, 59, 59, 999)
    const weekCount = events.filter((e) => {
      const s = new Date(e.start)
      return s >= weekStart && s <= weekEnd && !e.allDay
    }).length
    return { todayCount, weekCount }
  })()

  /* ── Main Render ──────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5">
      {/* Editorial Hero */}
      <div
        className="rounded-xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #15263a 0%, #24354d 45%, #3e6b5a 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(138, 150, 144, 0.35) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(62, 107, 90, 0.45) 0%, transparent 55%)',
          }}
        />
        <div className="relative flex flex-col gap-3 max-w-2xl">
          <p className="font-semibold text-[11px] text-white/70 tracking-[1.5px] uppercase">
            Your Schedule
          </p>
          <h2 className="font-bold text-[22px] text-white tracking-[-0.3px] leading-tight">
            <span className="italic font-serif font-normal text-white/90">
              "A calendar is a commitment map — the negative space is where the real work gets done."
            </span>
          </h2>
          <div className="flex items-center gap-2 text-[12px] text-white/70 mt-1">
            <span>
              <strong className="text-white">{heroStats.todayCount}</strong> today
            </span>
            <span className="text-white/40">·</span>
            <span>
              <strong className="text-white">{heroStats.weekCount}</strong> this work week
            </span>
            <span className="text-white/40">·</span>
            <span>
              Viewing{' '}
              <strong className="text-white">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Smart Insight Banner */}
      <CalendarInsight events={events} currentDate={currentDate} />

      {/* Calendar Card */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar — stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 py-2 border-b border-border gap-2">
            {/* Top row: nav + title */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-all shrink-0"
                style={{ background: 'linear-gradient(135deg, #3e6b5a 0%, #5a8f7b 100%)' }}
              >
                <Plus size={11} />
                <span className="hidden sm:inline">New Event</span>
                <span className="sm:hidden">New</span>
              </button>
              <button
                onClick={() => { setCurrentDate(new Date()) }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-input-bg text-text-primary hover:bg-border transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded-lg hover:bg-input-bg transition-colors"
              >
                <ChevronLeft size={14} className="text-text-secondary" />
              </button>
              <button
                onClick={() => navigate(1)}
                className="p-1 rounded-lg hover:bg-input-bg transition-colors"
              >
                <ChevronRight size={14} className="text-text-secondary" />
              </button>
              <span className="text-text-primary text-[13px] sm:text-[15px] font-semibold ml-1 truncate">{headerLabel}</span>
            </div>

            {/* Bottom row on mobile: view switcher */}
            <div className="flex items-center gap-1">
              {(['month', 'week', 'day'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all ${
                    view === v
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1 hidden sm:block" />
              <button
                onClick={() => setSidebarOpen((p) => !p)}
                className={`p-1 rounded-lg transition-colors hidden sm:block ${sidebarOpen ? 'bg-accent/10 text-accent' : 'hover:bg-input-bg text-text-muted'}`}
              >
                {sidebarOpen ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 flex-1">
              <Loader2 size={28} className="animate-spin text-accent" />
              <p className="text-text-muted text-[13px]">Loading calendar...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 flex-1 px-8">
              <CalendarIcon size={32} className="text-text-muted" />
              <p className="text-text-secondary text-[13px] text-center max-w-md">{error}</p>
              {apiUrl && (
                <button
                  onClick={loadEvents}
                  className="mt-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          ) : (
            <>
              {view === 'month' && <MonthView />}
              {view === 'week' && <WeekView />}
              {view === 'day' && <DayView />}
            </>
          )}
        </div>

        {/* Calendar Sidebar */}
        {sidebarOpen && <CalendarSidebar />}
      </div>

      {/* Event Modal */}
      <EventModal />
      <CreateEventModal />
    </div>
  )
}
