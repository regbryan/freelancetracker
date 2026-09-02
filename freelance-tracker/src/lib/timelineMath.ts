/**
 * Pure date + pixel math for the timeline. No React, no DOM, no Supabase.
 * All dates are ISO `yyyy-mm-dd` strings; comparisons use string ordering,
 * which is correct for that format.
 */

export type Zoom = 'week' | 'month' | 'quarter'

export const PX_PER_DAY: Record<Zoom, number> = { week: 40, month: 12, quarter: 4 }

export interface DateRange {
  start: string
  end: string
}

export interface Tick {
  iso: string
  offsetDays: number
  /** True for the synthetic tick at the range start when the range does not begin on the 1st. */
  partial?: true
}

export function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Whole days from `a` to `b`; positive when `b` is later. DST-safe via rounding. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

export function pxToDays(dx: number, pxPerDay: number): number {
  return Math.round(dx / pxPerDay)
}

export function shiftRange(r: DateRange, days: number): DateRange {
  return { start: addDays(r.start, days), end: addDays(r.end, days) }
}

export function resizeRange(r: DateRange, edge: 'start' | 'end', days: number): DateRange {
  if (edge === 'start') {
    const s = addDays(r.start, days)
    return { start: s > r.end ? r.end : s, end: r.end }
  }
  const e = addDays(r.end, days)
  return { start: r.start, end: e < r.start ? r.start : e }
}

/** Visible range: min(earliest, today-30) - 7 .. max(latest, today+90) + 14. */
export function computeRange(dates: Array<string | null | undefined>, today: string): DateRange {
  let min = addDays(today, -30)
  let max = addDays(today, 90)
  for (const d of dates) {
    if (!d) continue
    if (d < min) min = d
    if (d > max) max = d
  }
  return { start: addDays(min, -7), end: addDays(max, 14) }
}

export function totalDays(range: DateRange): number {
  return diffDays(range.start, range.end) + 1
}

export function monthTicks(range: DateRange): Tick[] {
  const out: Tick[] = []
  const first = parseDate(range.start)
  let cur = new Date(first.getFullYear(), first.getMonth(), 1)
  const end = parseDate(range.end)
  while (cur <= end) {
    const iso = toISO(cur)
    const offsetDays = diffDays(range.start, iso)
    if (offsetDays >= 0) out.push({ iso, offsetDays })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  if (out.length === 0 || out[0].offsetDays > 0) {
    out.unshift({ iso: range.start, offsetDays: 0, partial: true })
  }
  return out
}

export function dayTicks(range: DateRange): Tick[] {
  const n = diffDays(range.start, range.end)
  const out: Tick[] = []
  for (let i = 0; i <= n; i++) out.push({ iso: addDays(range.start, i), offsetDays: i })
  return out
}

export function weekendSpans(range: DateRange): { offsetDays: number; days: number }[] {
  const out: { offsetDays: number; days: number }[] = []
  const n = diffDays(range.start, range.end)
  let i = 0
  while (i <= n) {
    const dow = parseDate(addDays(range.start, i)).getDay()
    if (dow === 6) {
      out.push({ offsetDays: i, days: i + 1 <= n ? 2 : 1 })
      i += 2
    } else if (dow === 0) {
      out.push({ offsetDays: i, days: 1 })
      i += 1
    } else {
      i += 1
    }
  }
  return out
}

export function barGeometry(r: DateRange, rangeStart: string, pxPerDay: number): { left: number; width: number } {
  return {
    left: diffDays(rangeStart, r.start) * pxPerDay,
    width: (diffDays(r.start, r.end) + 1) * pxPerDay,
  }
}

/** Range for a project/task that may have only one of its two dates. */
export function entityRange(start: string | null, end: string | null): DateRange | null {
  const s = start ?? end
  const e = end ?? start
  if (!s || !e) return null
  return s <= e ? { start: s, end: e } : { start: e, end: s }
}
