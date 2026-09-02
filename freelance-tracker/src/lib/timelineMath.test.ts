import { describe, it, expect } from 'vitest'
import {
  PX_PER_DAY,
  MAX_SPAN_DAYS,
  addDays,
  diffDays,
  pxToDays,
  shiftRange,
  resizeRange,
  computeRange,
  monthTicks,
  dayTicks,
  weekendSpans,
  totalDays,
  barGeometry,
  entityRange,
  isValidISODate,
} from './timelineMath'

describe('addDays / diffDays', () => {
  it('adds across a month boundary', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
  })
  it('subtracts across a year boundary', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('diffDays is positive when b is after a', () => {
    expect(diffDays('2026-09-01', '2026-09-04')).toBe(3)
    expect(diffDays('2026-09-04', '2026-09-01')).toBe(-3)
  })
  it('diffDays is not thrown off by DST', () => {
    // US DST ends 2026-11-01
    expect(diffDays('2026-10-31', '2026-11-02')).toBe(2)
    // US DST begins (spring forward) 2026-03-08
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2)
  })
  it('runs in a DST timezone so the DST assertions are meaningful', () => {
    expect(new Date('2026-01-01T00:00:00').getTimezoneOffset()).not.toBe(
      new Date('2026-07-01T00:00:00').getTimezoneOffset(),
    )
  })
})

describe('pxToDays', () => {
  it('rounds to whole days', () => {
    expect(pxToDays(35, PX_PER_DAY.month)).toBe(3) // 35/12 = 2.9
    expect(pxToDays(-35, PX_PER_DAY.month)).toBe(-3)
    expect(pxToDays(5, PX_PER_DAY.month)).toBe(0)
  })
  it('never returns -0', () => {
    expect(Object.is(pxToDays(-3, 12), 0)).toBe(true)
  })
})

describe('shiftRange', () => {
  it('moves both ends', () => {
    expect(shiftRange({ start: '2026-09-01', end: '2026-09-03' }, 2)).toEqual({ start: '2026-09-03', end: '2026-09-05' })
  })
})

describe('resizeRange', () => {
  const r = { start: '2026-09-10', end: '2026-09-12' }
  it('moves only the start edge', () => {
    expect(resizeRange(r, 'start', -2)).toEqual({ start: '2026-09-08', end: '2026-09-12' })
  })
  it('moves only the end edge', () => {
    expect(resizeRange(r, 'end', 4)).toEqual({ start: '2026-09-10', end: '2026-09-16' })
  })
  it('clamps start so it never passes end (one-day minimum)', () => {
    expect(resizeRange(r, 'start', 10)).toEqual({ start: '2026-09-12', end: '2026-09-12' })
  })
  it('clamps end so it never precedes start', () => {
    expect(resizeRange(r, 'end', -10)).toEqual({ start: '2026-09-10', end: '2026-09-10' })
  })
})

describe('computeRange', () => {
  const today = '2026-09-01'
  it('defaults to today-30-7 .. today+90+14 when there are no dates', () => {
    expect(computeRange([], today)).toEqual({ start: '2026-07-26', end: '2026-12-14' })
  })
  it('extends to cover earlier and later dates, ignoring nulls', () => {
    expect(computeRange(['2026-05-01', null, '2027-02-01'], today)).toEqual({ start: '2026-04-24', end: '2027-02-15' })
  })
  it('ignores inputs that are not strictly yyyy-mm-dd', () => {
    expect(computeRange(['2026-05-01T12:00:00+00:00', ' ', ''], today)).toEqual({ start: '2026-07-26', end: '2026-12-14' })
  })
  it('ignores inputs that are shaped like a date but are not a real calendar date', () => {
    expect(computeRange(['2026-13-45', '2026-02-30'], today)).toEqual({ start: '2026-07-26', end: '2026-12-14' })
  })
  it('clamps a far-past date toward today instead of excluding today', () => {
    const range = computeRange(['2016-09-01'], today)
    expect(range.start).toBe(addDays(addDays(today, -730), -7))
    expect(range.end).toBe('2026-12-14')
    expect(range.start <= today && today <= range.end).toBe(true)
  })
  it('clamps a far-future date toward today instead of excluding today', () => {
    const range = computeRange(['2226-09-01'], today)
    expect(range.start).toBe('2026-07-26')
    expect(range.end).toBe(addDays(addDays(today, 730), 14))
    expect(range.start <= today && today <= range.end).toBe(true)
  })
  it('clamps both ends when dates are far in the past and future', () => {
    const range = computeRange(['2016-09-01', '2226-09-01'], today)
    expect(range.start).toBe(addDays(addDays(today, -730), -7))
    expect(range.end).toBe(addDays(addDays(today, 730), 14))
    expect(totalDays(range)).toBeLessThanOrEqual(MAX_SPAN_DAYS + 22)
    expect(range.start <= today && today <= range.end).toBe(true)
  })
})

describe('isValidISODate', () => {
  it('accepts real calendar dates in strict yyyy-mm-dd form', () => {
    expect(isValidISODate('2026-05-01')).toBe(true)
    expect(isValidISODate('2026-02-28')).toBe(true)
  })
  it('rejects out-of-range month/day and rollover dates', () => {
    expect(isValidISODate('2026-13-45')).toBe(false)
    expect(isValidISODate('2026-02-30')).toBe(false)
  })
  it('rejects a year that is not 4 digits', () => {
    expect(isValidISODate('0226-09-01')).toBe(false)
  })
  it('rejects non-padded shapes', () => {
    expect(isValidISODate('2026-5-1')).toBe(false)
  })
})

describe('totalDays', () => {
  it('counts both ends inclusive', () => {
    expect(totalDays({ start: '2026-09-01', end: '2026-09-01' })).toBe(1)
    expect(totalDays({ start: '2026-09-01', end: '2026-09-10' })).toBe(10)
  })
})

describe('monthTicks', () => {
  it('emits a tick at every first-of-month inside the range and a partial tick at the start', () => {
    const ticks = monthTicks({ start: '2026-11-20', end: '2027-01-10' })
    expect(ticks.map((t) => [t.iso, t.offsetDays])).toEqual([
      ['2026-11-20', 0],
      ['2026-12-01', 11],
      ['2027-01-01', 42],
    ])
    expect(ticks[0].partial).toBe(true)
    expect(ticks[1].partial).toBeUndefined()
  })
  it('does not duplicate when the range starts on the first', () => {
    const ticks = monthTicks({ start: '2026-09-01', end: '2026-09-15' })
    expect(ticks).toEqual([{ iso: '2026-09-01', offsetDays: 0 }])
  })
})

describe('dayTicks', () => {
  it('emits one tick per day inclusive', () => {
    const ticks = dayTicks({ start: '2026-09-01', end: '2026-09-03' })
    expect(ticks).toEqual([
      { iso: '2026-09-01', offsetDays: 0 },
      { iso: '2026-09-02', offsetDays: 1 },
      { iso: '2026-09-03', offsetDays: 2 },
    ])
  })
})

describe('weekendSpans', () => {
  it('finds Sat+Sun pairs and a lone Sunday at the start', () => {
    // 2026-09-06 is a Sunday; 2026-09-12 is a Saturday
    expect(weekendSpans({ start: '2026-09-06', end: '2026-09-14' })).toEqual([
      { offsetDays: 0, days: 1 },
      { offsetDays: 6, days: 2 },
    ])
  })
  it('handles a lone Saturday at the end', () => {
    expect(weekendSpans({ start: '2026-09-07', end: '2026-09-12' })).toEqual([{ offsetDays: 5, days: 1 }])
  })
})

describe('barGeometry', () => {
  it('positions by offset from range start and inclusive width', () => {
    expect(barGeometry({ start: '2026-09-04', end: '2026-09-06' }, '2026-09-01', 12)).toEqual({ left: 36, width: 36 })
  })
})

describe('entityRange', () => {
  it('uses both dates when present', () => {
    expect(entityRange('2026-09-01', '2026-09-05')).toEqual({ start: '2026-09-01', end: '2026-09-05' })
  })
  it('collapses to a single day when only one date exists', () => {
    expect(entityRange(null, '2026-09-05')).toEqual({ start: '2026-09-05', end: '2026-09-05' })
    expect(entityRange('2026-09-01', null)).toEqual({ start: '2026-09-01', end: '2026-09-01' })
  })
  it('treats an empty string as missing', () => {
    expect(entityRange('', '2026-09-05')).toEqual({ start: '2026-09-05', end: '2026-09-05' })
  })
  it('returns null when neither exists', () => {
    expect(entityRange(null, null)).toBeNull()
  })
  it('swaps reversed dates so start is never after end', () => {
    expect(entityRange('2026-09-09', '2026-09-02')).toEqual({ start: '2026-09-02', end: '2026-09-09' })
  })
})
