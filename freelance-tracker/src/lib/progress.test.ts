import { describe, it, expect } from 'vitest'
import {
  clampProgress,
  statusForProgress,
  meanProgress,
  assigneeLabel,
  assigneeInitials,
  formatHours,
} from './progress'

describe('clampProgress', () => {
  it('keeps a whole percentage inside the range', () => {
    expect(clampProgress(0)).toBe(0)
    expect(clampProgress(50)).toBe(50)
    expect(clampProgress(100)).toBe(100)
  })

  it('clamps out-of-range values instead of storing them', () => {
    expect(clampProgress(-20)).toBe(0)
    expect(clampProgress(140)).toBe(100)
  })

  it('rounds fractions to whole percent', () => {
    expect(clampProgress(33.4)).toBe(33)
    expect(clampProgress(33.5)).toBe(34)
  })

  it('treats a missing column as 0 rather than NaN', () => {
    // Every row looks like this until supabase_migration_task_progress.sql runs.
    expect(clampProgress(undefined)).toBe(0)
    expect(clampProgress(null)).toBe(0)
    expect(clampProgress(Number.NaN)).toBe(0)
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('statusForProgress', () => {
  it('finishing the bar marks the task done', () => {
    expect(statusForProgress('todo', 100)).toBe('done')
    expect(statusForProgress('in_progress', 100)).toBe('done')
    expect(statusForProgress('done', 100)).toBe('done')
  })

  it('pulling a done task back below 100 reopens it as in progress', () => {
    expect(statusForProgress('done', 80)).toBe('in_progress')
    expect(statusForProgress('done', 0)).toBe('in_progress')
  })

  it('leaves any other status alone', () => {
    // 40% of a task that has not been started yet is still planning, not work.
    expect(statusForProgress('todo', 40)).toBe('todo')
    expect(statusForProgress('in_progress', 40)).toBe('in_progress')
    expect(statusForProgress('todo', 0)).toBe('todo')
  })

  it('clamps before deciding, so 120 still means done', () => {
    expect(statusForProgress('todo', 120)).toBe('done')
    expect(statusForProgress('done', -5)).toBe('in_progress')
  })
})

describe('meanProgress', () => {
  it('is 0 for no tasks at all', () => {
    expect(meanProgress([])).toBe(0)
  })

  it('averages the tasks it is given', () => {
    expect(meanProgress([{ progress: 0 }, { progress: 50 }, { progress: 100 }])).toBe(50)
  })

  it('rounds to a whole percent', () => {
    // 0 + 50 + 100 + 100 = 250 / 3 rows is not the point; 2/3 of 100 is.
    expect(meanProgress([{ progress: 100 }, { progress: 100 }, { progress: 0 }])).toBe(67)
  })

  it('counts a task with no progress column as 0, not as absent', () => {
    expect(meanProgress([{ progress: 100 }, {}])).toBe(50)
    expect(meanProgress([{ progress: 100 }, { progress: null }])).toBe(50)
  })
})

describe('assigneeLabel', () => {
  const members = ['courtney@example.com', 'Sam@Example.com']

  it("'me' is the owner, by profile name when there is one", () => {
    expect(assigneeLabel('me', 'Reggie Bryant', members)).toBe('Reggie Bryant')
  })

  it("'me' falls back to Me when the profile has no name yet", () => {
    expect(assigneeLabel('me', '', members)).toBe('Me')
    expect(assigneeLabel('me', null, members)).toBe('Me')
    expect(assigneeLabel('me', '   ', members)).toBe('Me')
  })

  it("a member's email reads as the capitalised local part", () => {
    expect(assigneeLabel('courtney@example.com', 'Reggie', members)).toBe('Courtney')
  })

  it('matches a member regardless of case', () => {
    expect(assigneeLabel('SAM@example.com', 'Reggie', members)).toBe('Sam')
  })

  it('empty and null are unassigned', () => {
    expect(assigneeLabel('', 'Reggie', members)).toBe('Unassigned')
    expect(assigneeLabel(null, 'Reggie', members)).toBe('Unassigned')
    expect(assigneeLabel(undefined, 'Reggie', members)).toBe('Unassigned')
    expect(assigneeLabel('   ', 'Reggie', members)).toBe('Unassigned')
  })

  it('anything else is shown exactly as stored', () => {
    // The client names carried over from meeting notes keep working as display text.
    expect(assigneeLabel('Jamie at Acme', 'Reggie', members)).toBe('Jamie at Acme')
    // An email nobody on this project owns is not a member, so it is not shortened.
    expect(assigneeLabel('stranger@example.com', 'Reggie', members)).toBe('stranger@example.com')
  })
})

describe('assigneeInitials', () => {
  it('takes the first and last word, never the middle', () => {
    expect(assigneeInitials('Reggie Bryant')).toBe('RB')
    expect(assigneeInitials('Jamie at SiFive')).toBe('JS')
  })

  it('one word is one letter', () => {
    expect(assigneeInitials('Courtney')).toBe('C')
  })

  it('an address that slipped through loses its domain first', () => {
    // Otherwise courtney@acme.com would read as "CA", initials of a company.
    expect(assigneeInitials('courtney@acme.com')).toBe('C')
    expect(assigneeInitials('anna.marie@acme.com')).toBe('AM')
  })

  it('nothing to abbreviate is no circle at all', () => {
    expect(assigneeInitials('')).toBe('')
    expect(assigneeInitials('   ')).toBe('')
    expect(assigneeInitials(null)).toBe('')
    expect(assigneeInitials(undefined)).toBe('')
  })
})

describe('formatHours', () => {
  it('writes hours the way a person does', () => {
    expect(formatHours(4)).toBe('4')
    // NUMERIC(6,2) arrives as '4.50' from some drivers; nobody writes it that way.
    expect(formatHours('4.50')).toBe('4.5')
    expect(formatHours(4.567)).toBe('4.57')
  })

  it('anything unusable is zero, not NaN on the screen', () => {
    expect(formatHours(null)).toBe('0')
    expect(formatHours(undefined)).toBe('0')
    expect(formatHours('nope')).toBe('0')
  })
})
