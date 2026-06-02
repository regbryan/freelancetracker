// Pure helpers for invoice billing periods.
// A "month input" is the value of <input type="month">, formatted "YYYY-MM".
// A "period" is an inclusive calendar-month range stored as ISO date strings.

export interface BillingPeriod {
  start: string // YYYY-MM-01
  end: string   // YYYY-MM-<last day>
}

/** "2026-04" -> { start: "2026-04-01", end: "2026-04-30" } */
export function monthInputToPeriod(monthInput: string): BillingPeriod {
  const [yearStr, monthStr] = monthInput.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) // 1-12
  // Day 0 of the next month is the last day of this month.
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  const dd = String(lastDay).padStart(2, '0')
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${dd}` }
}

/** "2026-04-01" -> "2026-04". Returns "" for null/empty/malformed input. */
export function dateToMonthInput(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const match = /^(\d{4})-(\d{2})/.exec(dateStr)
  return match ? `${match[1]}-${match[2]}` : ''
}

/** Returns "YYYY-MM" for the latest date in the list, or "" if the list is empty. */
export function latestMonthInput(dateStrings: string[]): string {
  let max = ''
  for (const d of dateStrings) {
    if (d > max) max = d
  }
  return dateToMonthInput(max)
}

/** Current month as "YYYY-MM". */
export function currentMonthInput(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${mm}`
}

/**
 * Human-readable inclusive range, e.g. "April 1 – April 30, 2026".
 * Repeats the year on both sides only when start and end fall in different years.
 */
export function formatBillingPeriod(start: string, end: string, locale: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameYear = s.getFullYear() === e.getFullYear()
  const endStr = e.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
  const startStr = s.toLocaleDateString(
    locale,
    sameYear
      ? { month: 'long', day: 'numeric' }
      : { month: 'long', day: 'numeric', year: 'numeric' }
  )
  return `${startStr} – ${endStr}`
}
