/**
 * Pure date + pixel math for the timeline. No React, no DOM, no Supabase.
 * All dates are ISO `yyyy-mm-dd` strings; comparisons use string ordering,
 * which is correct for that format.
 */

export type Zoom = 'week' | 'month' | 'quarter'

export const PX_PER_DAY = { week: 40, month: 12, quarter: 4 } as const satisfies Record<Zoom, number>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True only for a real calendar date in strict yyyy-mm-dd form (rejects rollover like 2026-02-30). */
export function isValidISODate(d: string): boolean {
  return ISO_DATE.test(d) && toISO(parseDate(d)) === d
}

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
  return Math.round(dx / pxPerDay) || 0
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

export const MAX_SPAN_DAYS = 1461

/** Smallest and largest valid ISO date in the list, or null when there are none. */
function dateBounds(dates: Array<string | null | undefined>): { min: string; max: string } | null {
  let min: string | null = null
  let max: string | null = null
  for (const d of dates) {
    if (!d || !isValidISODate(d)) continue
    if (min === null || d < min) min = d
    if (max === null || d > max) max = d
  }
  return min === null || max === null ? null : { min, max }
}

/**
 * Shared tail of the two range builders: clamp an over-long span back toward
 * today (never toward the near end, so today stays inside the range), then pad
 * a week before and a fortnight after.
 */
function padAndClamp(min: string, max: string, today: string): DateRange {
  const half = Math.floor(MAX_SPAN_DAYS / 2)
  if (diffDays(min, max) > MAX_SPAN_DAYS) {
    const lo = addDays(today, -half)
    const hi = addDays(today, half)
    if (min < lo) min = lo
    if (max > hi) max = hi
  }
  return { start: addDays(min, -7), end: addDays(max, 14) }
}

/**
 * Visible range: min(earliest, today-30) - 7 .. max(latest, today+90) + 14.
 * Inputs that are not yyyy-mm-dd are ignored. If the raw span would exceed
 * MAX_SPAN_DAYS, the far end is trimmed back toward today (not toward the
 * near end) so today always stays inside the returned range.
 */
export function computeRange(dates: Array<string | null | undefined>, today: string): DateRange {
  let min = addDays(today, -30)
  let max = addDays(today, 90)
  const bounds = dateBounds(dates)
  if (bounds) {
    if (bounds.min < min) min = bounds.min
    if (bounds.max > max) max = bounds.max
  }
  return padAndClamp(min, max, today)
}

/**
 * Content-driven range: min(earliest, today) - 7 .. max(latest, today) + 14.
 *
 * `computeRange` always reserves today-30..today+90, which for a project whose
 * work finished months ago pushes every bar off the left of the first screen.
 * This one hugs the actual content and only stretches as far as today so the
 * today line still has somewhere to land. Same ISO validation and the same
 * MAX_SPAN_DAYS clamp; with no valid dates it falls back to `computeRange`.
 */
export function computeContentRange(dates: Array<string | null | undefined>, today: string): DateRange {
  const bounds = dateBounds(dates)
  if (!bounds) return computeRange([], today)
  const min = bounds.min < today ? bounds.min : today
  const max = bounds.max > today ? bounds.max : today
  return padAndClamp(min, max, today)
}

/**
 * Day offset the view should open at: today when today falls inside the content,
 * otherwise the earliest dated thing — scrolling to today in a plan that ended in
 * March shows a screenful of empty track. Never negative.
 */
export function initialScrollDay(
  range: DateRange,
  dates: Array<string | null | undefined>,
  today: string,
): number {
  const bounds = dateBounds(dates)
  const target = !bounds || (today >= bounds.min && today <= bounds.max) ? today : bounds.min
  return Math.max(0, diffDays(range.start, target))
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
  const s = start || end
  const e = end || start
  if (!s || !e) return null
  return s <= e ? { start: s, end: e } : { start: e, end: s }
}
