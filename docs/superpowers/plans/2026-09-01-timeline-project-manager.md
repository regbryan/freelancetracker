# Timeline Project Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only Timeline page into a drag-editable planner, let invited collaborators edit tasks on shared projects, and show the same timeline read-only in the client portal.

**Architecture:** A pure date/geometry module (`timelineMath.ts`) feeds a reusable `TimelineGantt` component with an `editable` switch. The `/timeline` page, the client portal, and (indirectly) the collaborator all render that one component. Access for collaborators is a new `project_members` table plus row-level-security changes on `projects` and `tasks` only; a `useWorkspaceRole` hook classifies the signed-in user as owner, collaborator, or portal and the shell adapts.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 4, react-router 7, Supabase (Postgres RLS), vitest 4 + Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md`

**Working directory for every command:** `~/dev/freelancetracker/freelance-tracker` (the Vite app). Git commands run from the repo root `~/dev/freelancetracker`. Branch: `feature/timeline-collab` (already created).

**Conventions in this codebase:**
- Every user-facing string goes through `t('key')` from `useI18n()`; keys live in `src/lib/i18n.tsx` in two dictionaries, `en` (starts line 10) and `es` (starts ~line 1510). Add each new key to **both**.
- Dates are ISO `yyyy-mm-dd` strings; parse with `new Date(iso + 'T00:00:00')` to avoid timezone shifts.
- Tests: `npx vitest run <path>`; files sit next to the code as `*.test.ts(x)`; component tests wrap in `<I18nProvider>`.
- Lint: `npm run lint`. Type-check + build: `npm run build`.
- Commit messages: `type(scope): summary`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never push. Never deploy. Never run a production migration without Reggie's explicit approval in chat.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/timelineMath.ts` | create | Pure date and pixel math: ranges, ticks, drag deltas, clamping |
| `src/lib/timelineMath.test.ts` | create | Unit tests for the above |
| `src/components/TimelineGantt.tsx` | create | Reusable Gantt: rows, bars, tray, drag/resize, legend |
| `src/components/TimelineGantt.test.tsx` | create | Render + pointer-drag tests |
| `src/pages/Timeline.tsx` | rewrite | Page shell: hero, tabs, filter, zoom, data wiring, TaskForm, error banner |
| `src/components/WorkTabs.tsx` | modify | Tab order Timeline · List · Timer; hide Timer for collaborators |
| `src/components/Sidebar.tsx` | modify | Work → `/timeline`; collaborator gets two items, no quick-create |
| `src/components/BottomNav.tsx` | modify | Collaborator gets Timeline + List only |
| `src/components/Layout.tsx` | modify | No quick-log dialog/shortcut for collaborators |
| `src/pages/ProjectDetail.tsx` | modify | "Open timeline" button; Collaborators card |
| `supabase_migration_project_members.sql` | create | Table, definer function, RLS policies |
| `src/hooks/useProjectMembers.ts` | create | CRUD for `project_members`; email normalisation |
| `src/hooks/useProjectMembers.test.ts` | create | Tests for `normalizeEmail` |
| `src/components/ProjectCollaboratorsCard.tsx` | create | Owner UI to add/remove collaborator emails |
| `src/hooks/useWorkspaceRole.ts` | create | Role detection + React context |
| `src/hooks/useWorkspaceRole.test.ts` | create | Tests for `resolveRole` |
| `src/components/OwnerGate.tsx` | rewrite | Uses the hook; provides context; redirects portal/collaborator |
| `src/pages/Portal.tsx` | modify | Timeline · List toggle; read-only Gantt |
| `src/lib/i18n.tsx` | modify | New keys (en + es), two removed keys |

---

### Task 1: Pure timeline math

**Files:**
- Create: `src/lib/timelineMath.ts`
- Test: `src/lib/timelineMath.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/lib/timelineMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  PX_PER_DAY,
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
  })
})

describe('pxToDays', () => {
  it('rounds to whole days', () => {
    expect(pxToDays(35, PX_PER_DAY.month)).toBe(3) // 35/12 = 2.9
    expect(pxToDays(-35, PX_PER_DAY.month)).toBe(-3)
    expect(pxToDays(5, PX_PER_DAY.month)).toBe(0)
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
  it('returns null when neither exists', () => {
    expect(entityRange(null, null)).toBeNull()
  })
  it('swaps reversed dates so start is never after end', () => {
    expect(entityRange('2026-09-09', '2026-09-02')).toEqual({ start: '2026-09-02', end: '2026-09-09' })
  })
})
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timelineMath.test.ts`
Expected: FAIL — "Failed to resolve import './timelineMath'".

- [x] **Step 3: Implement the module**

Create `src/lib/timelineMath.ts`:

```ts
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
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timelineMath.test.ts`
Expected: PASS, 23 tests.

- [x] **Step 5: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/lib/timelineMath.ts freelance-tracker/src/lib/timelineMath.test.ts && git commit -m "feat(timeline): pure date and pixel math for the gantt

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: i18n keys for the timeline and portal

**Files:**
- Modify: `src/lib/i18n.tsx` (en block near line 465–481, es block near line 1958–1974)

- [x] **Step 1: Replace the English timeline keys**

In `src/lib/i18n.tsx`, in the `en` dictionary, find these two lines and delete them:

```ts
  'timeline.noDates': 'No projects have start or end dates yet.',
  'timeline.noDatesHelp': 'Open a project, click Edit, and set its start and end dates to see them here.',
```

Then find the line `  'timeline.today': 'Today',` in the `en` dictionary and insert immediately after it:

```ts
  'timeline.zoomWeek': 'Week',
  'timeline.zoomMonth': 'Month',
  'timeline.zoomQuarter': 'Quarter',
  'timeline.zoomLabel': 'Zoom',
  'timeline.filterProject': 'Project',
  'timeline.allProjects': 'All projects',
  'timeline.notScheduled': 'Not scheduled ({n})',
  'timeline.scheduleHint': 'Click to place at today, then drag',
  'timeline.empty': 'No projects yet. Create a project to start planning.',
  'timeline.saveFailed': 'Could not save dates: {error}',
  'timeline.dragHint': 'Drag a bar to move it · drag an edge to change its length · click to edit',
  'timeline.editTask': 'Edit task',
  'projectDetail.openTimeline': 'Open timeline',
  'collab.title': 'Collaborators',
  'collab.desc': 'People who can add and edit tasks on this project. They sign up at the normal login page with this exact email.',
  'collab.emailPlaceholder': 'colleague@example.com',
  'collab.add': 'Add',
  'collab.remove': 'Remove',
  'collab.empty': 'No collaborators yet.',
  'collab.duplicate': 'That email is already a collaborator.',
  'collab.invalidEmail': 'Enter a valid email address.',
  'collab.failed': 'Could not add collaborator.',
  'portal.viewTimeline': 'Timeline',
  'portal.viewList': 'List',
```

- [x] **Step 2: Replace the Spanish timeline keys**

In the `es` dictionary, delete:

```ts
  'timeline.noDates': 'Ningún proyecto tiene fechas de inicio o fin aún.',
  'timeline.noDatesHelp': 'Abre un proyecto, haz clic en Editar y configura sus fechas de inicio y fin para verlas aquí.',
```

Find `  'timeline.today': 'Hoy',` in the `es` dictionary and insert immediately after it:

```ts
  'timeline.zoomWeek': 'Semana',
  'timeline.zoomMonth': 'Mes',
  'timeline.zoomQuarter': 'Trimestre',
  'timeline.zoomLabel': 'Zoom',
  'timeline.filterProject': 'Proyecto',
  'timeline.allProjects': 'Todos los proyectos',
  'timeline.notScheduled': 'Sin programar ({n})',
  'timeline.scheduleHint': 'Clic para colocar hoy y luego arrastrar',
  'timeline.empty': 'Aún no hay proyectos. Crea un proyecto para empezar a planificar.',
  'timeline.saveFailed': 'No se pudieron guardar las fechas: {error}',
  'timeline.dragHint': 'Arrastra una barra para moverla · arrastra un borde para cambiar su duración · clic para editar',
  'timeline.editTask': 'Editar tarea',
  'projectDetail.openTimeline': 'Abrir cronología',
  'collab.title': 'Colaboradores',
  'collab.desc': 'Personas que pueden añadir y editar tareas de este proyecto. Se registran en la página de inicio de sesión normal con este mismo correo.',
  'collab.emailPlaceholder': 'colega@ejemplo.com',
  'collab.add': 'Añadir',
  'collab.remove': 'Quitar',
  'collab.empty': 'Aún no hay colaboradores.',
  'collab.duplicate': 'Ese correo ya es colaborador.',
  'collab.invalidEmail': 'Introduce un correo válido.',
  'collab.failed': 'No se pudo añadir el colaborador.',
  'portal.viewTimeline': 'Cronología',
  'portal.viewList': 'Lista',
```

- [x] **Step 3: Verify the two dictionaries still type-check and nothing references the removed keys**

Run: `grep -rn "timeline.noDates" src` → expected: only `src/pages/Timeline.tsx` (it is rewritten in Task 4).
Run: `npx tsc -b --noEmit` → expected: no output (clean). Note: `tsc -b` with project references may not accept `--noEmit`; if it errors on the flag, run `npx tsc -p tsconfig.app.json --noEmit` instead.

- [x] **Step 4: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/lib/i18n.tsx && git commit -m "feat(i18n): timeline zoom/filter/tray, collaborators, and portal view strings (en, es)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `TimelineGantt` component — static render

Drag comes in Task 4. This task renders rows, bars, the tray, the header, and the legend, and passes tests for structure and read-only behaviour.

**Files:**
- Create: `src/components/TimelineGantt.tsx`
- Test: `src/components/TimelineGantt.test.tsx`

- [x] **Step 1: Write the failing render tests**

Create `src/components/TimelineGantt.test.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../lib/i18n'
import TimelineGantt, { type GanttProject, type GanttTask } from './TimelineGantt'
import { PX_PER_DAY, computeRange, diffDays } from '../lib/timelineMath'

const TODAY = '2026-09-01'

const projects: GanttProject[] = [
  { id: 'p1', name: 'ProSeries Marketing', status: 'active', start_date: '2026-09-01', end_date: '2026-10-31' },
  { id: 'p2', name: 'Undated Project', status: 'active', start_date: null, end_date: null },
]

const tasks: GanttTask[] = [
  { id: 't1', project_id: 'p1', title: 'Brand audit', status: 'in_progress', start_date: '2026-09-10', due_date: '2026-09-12' },
  { id: 't2', project_id: 'p1', title: 'Launch plan', status: 'todo', start_date: null, due_date: null },
  { id: 't3', project_id: 'p2', title: 'Kickoff', status: 'todo', start_date: null, due_date: '2026-09-20' },
]

type Props = Partial<ComponentProps<typeof TimelineGantt>>

function setup(over: Props = {}) {
  const onTaskDates = vi.fn().mockResolvedValue(undefined)
  const onTaskClick = vi.fn()
  const onScheduleTask = vi.fn().mockResolvedValue(undefined)
  render(
    <I18nProvider>
      <TimelineGantt
        projects={projects}
        tasks={tasks}
        zoom="month"
        editable={true}
        today={TODAY}
        onTaskDates={onTaskDates}
        onTaskClick={onTaskClick}
        onScheduleTask={onScheduleTask}
        {...over}
      />
    </I18nProvider>,
  )
  return { onTaskDates, onTaskClick, onScheduleTask }
}

describe('TimelineGantt render', () => {
  it('renders every project row, including undated ones', () => {
    setup()
    expect(screen.getByText('ProSeries Marketing')).toBeInTheDocument()
    expect(screen.getByText('Undated Project')).toBeInTheDocument()
  })

  it('renders one bar per dated task and positions it by day offset', () => {
    setup()
    const bar = screen.getByRole('button', { name: /Brand audit/ })
    const range = computeRange(['2026-09-01', '2026-10-31', '2026-09-10', '2026-09-12', '2026-09-20'], TODAY)
    const left = diffDays(range.start, '2026-09-10') * PX_PER_DAY.month
    expect(bar).toHaveStyle({ left: `${left}px`, width: `${3 * PX_PER_DAY.month}px` })
  })

  it('shows undated tasks in a Not scheduled tray instead of hiding them', () => {
    setup()
    const tray = screen.getByText('Not scheduled (1)').closest('[data-testid="tray"]')!
    expect(within(tray).getByRole('button', { name: 'Launch plan' })).toBeInTheDocument()
  })

  it('clicking a tray chip schedules the task at today for one week', async () => {
    const { onScheduleTask } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Launch plan' }))
    expect(onScheduleTask).toHaveBeenCalledWith('t2', { start_date: '2026-09-01', due_date: '2026-09-07' })
  })

  it('a task with only a due date renders as a one-day bar', () => {
    setup()
    const bar = screen.getByRole('button', { name: /Kickoff/ })
    expect(bar).toHaveStyle({ width: `${PX_PER_DAY.month}px` })
  })

  it('read-only mode renders no resize handles and ignores chip clicks', () => {
    const { onScheduleTask } = setup({ editable: false })
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Launch plan' }))
    expect(onScheduleTask).not.toHaveBeenCalled()
  })

  it('week zoom draws day numbers and weekend shading', () => {
    setup({ zoom: 'week' })
    expect(document.querySelectorAll('[data-testid="weekend"]').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })
})
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/TimelineGantt.test.tsx`
Expected: FAIL — cannot resolve `./TimelineGantt`.

- [x] **Step 3: Implement the static component**

Create `src/components/TimelineGantt.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { useI18n } from '../lib/i18n'
import {
  PX_PER_DAY,
  type Zoom,
  type DateRange,
  type Tick,
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
  todayISO,
  barGeometry,
  entityRange,
  parseDate,
} from '../lib/timelineMath'

export interface GanttProject {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
}

export interface GanttTask {
  id: string
  project_id: string
  title: string
  status: string
  start_date: string | null
  due_date: string | null
}

export interface TaskDates {
  start_date: string
  due_date: string
}

export interface ProjectDates {
  start_date: string
  end_date: string
}

export interface TimelineGanttProps {
  projects: GanttProject[]
  tasks: GanttTask[]
  zoom: Zoom
  editable: boolean
  /** Owner only. Lets project bars be dragged. */
  canEditProjects?: boolean
  onTaskDates?: (id: string, dates: TaskDates) => Promise<void>
  onProjectDates?: (id: string, dates: ProjectDates) => Promise<void>
  onTaskClick?: (id: string) => void
  onScheduleTask?: (id: string, dates: TaskDates) => Promise<void>
  /** Fixes "today" for deterministic tests. */
  today?: string
}

export const LABEL_W = 220
const EDGE_PX = 8
const CLICK_PX = 3

const STATUS_COLORS: Record<string, string> = {
  active: '#3e6b5a',
  completed: '#16a34a',
  on_hold: '#d97706',
  cancelled: '#6b7280',
}

const TASK_STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  done: { bg: '#bbf7d0', border: '#16a34a' },
  in_progress: { bg: '#c8dcd1', border: '#3e6b5a' },
  todo: { bg: '#e5e7eb', border: '#9ca3af' },
}

type DragState = {
  kind: 'task' | 'project'
  id: string
  mode: 'move' | 'start' | 'end'
  originX: number
  orig: DateRange
  current: DateRange
  moved: boolean
}

function keyOf(kind: 'task' | 'project', id: string): string {
  return `${kind}:${id}`
}

/** Weekend shading, month gridlines, and the today line behind a row's bars. Top-level so it is a stable component. */
function TrackBg({
  height,
  weekends,
  months,
  todayLeft,
  px,
}: {
  height: number
  weekends: { offsetDays: number; days: number }[]
  months: Tick[]
  todayLeft: number
  px: number
}) {
  return (
    <>
      {weekends.map((w) => (
        <div
          key={w.offsetDays}
          data-testid="weekend"
          className="absolute top-0 bg-input-bg/60"
          style={{ left: w.offsetDays * px, width: w.days * px, height }}
        />
      ))}
      {months.map((tick) => (
        <div key={tick.iso} className="absolute top-0 w-px bg-border/30" style={{ left: tick.offsetDays * px, height }} />
      ))}
      <div className="absolute top-0 w-0.5 bg-accent/20" style={{ left: todayLeft, height }} />
    </>
  )
}

export default function TimelineGantt({
  projects,
  tasks,
  zoom,
  editable,
  canEditProjects = false,
  onTaskDates,
  onProjectDates,
  onTaskClick,
  onScheduleTask,
  today: todayProp,
}: TimelineGanttProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const today = todayProp ?? todayISO()
  const px = PX_PER_DAY[zoom]

  const range = useMemo(
    () =>
      computeRange(
        [
          ...projects.flatMap((p) => [p.start_date, p.end_date]),
          ...tasks.flatMap((tk) => [tk.start_date, tk.due_date]),
        ],
        today,
      ),
    [projects, tasks, today],
  )
  const trackW = totalDays(range) * px
  const months = useMemo(() => monthTicks(range), [range])
  const days = useMemo(() => (zoom === 'week' ? dayTicks(range) : []), [range, zoom])
  const weekends = useMemo(() => (zoom === 'week' ? weekendSpans(range) : []), [range, zoom])
  const todayLeft = diffDays(range.start, today) * px

  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [overrides, setOverrides] = useState<Record<string, DateRange>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll so today sits ~25% from the left of the track on mount and zoom change.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, todayLeft - Math.max(0, el.clientWidth - LABEL_W) * 0.25)
  }, [zoom, todayLeft])

  // Escape cancels an in-progress drag.
  useEffect(() => {
    if (!drag) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dragRef.current = null
        setDrag(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drag])

  function fmt(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  function monthLabel(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }

  function displayRange(kind: 'task' | 'project', id: string, base: DateRange): DateRange {
    if (drag && drag.kind === kind && drag.id === id) return drag.current
    return overrides[keyOf(kind, id)] ?? base
  }

  // ---- drag handlers (wired in Task 4; kept here so the static build compiles) ----
  function beginDrag(e: ReactPointerEvent<HTMLElement>, kind: 'task' | 'project', id: string, orig: DateRange) {
    if (!editable) return
    if (kind === 'project' && !canEditProjects) return
    if (e.button !== 0) return
    const edge = (e.target as HTMLElement).dataset.edge as 'start' | 'end' | undefined
    const st: DragState = { kind, id, mode: edge ?? 'move', originX: e.clientX, orig, current: orig, moved: false }
    dragRef.current = st
    setDrag(st)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom has no pointer capture */
    }
    e.preventDefault()
  }

  function moveDrag(e: ReactPointerEvent<HTMLElement>) {
    const st = dragRef.current
    if (!st) return
    const dx = e.clientX - st.originX
    const moved = st.moved || Math.abs(dx) >= CLICK_PX
    const d = pxToDays(dx, px)
    const current = st.mode === 'move' ? shiftRange(st.orig, d) : resizeRange(st.orig, st.mode, d)
    const next: DragState = { ...st, current, moved }
    dragRef.current = next
    setDrag(next)
  }

  function endDrag() {
    const st = dragRef.current
    if (!st) return
    dragRef.current = null
    setDrag(null)
    if (!st.moved) {
      if (st.kind === 'task') onTaskClick?.(st.id)
      return
    }
    if (st.current.start === st.orig.start && st.current.end === st.orig.end) return
    const key = keyOf(st.kind, st.id)
    setOverrides((o) => ({ ...o, [key]: st.current }))
    const p =
      st.kind === 'task'
        ? onTaskDates?.(st.id, { start_date: st.current.start, due_date: st.current.end })
        : onProjectDates?.(st.id, { start_date: st.current.start, end_date: st.current.end })
    Promise.resolve(p)
      .catch(() => undefined)
      .finally(() =>
        setOverrides((o) => {
          const rest = { ...o }
          delete rest[key]
          return rest
        }),
      )
  }

  /** Keyboard activation only — pointer clicks are resolved in endDrag. */
  function onBarClick(e: ReactMouseEvent<HTMLElement>, kind: 'task' | 'project', id: string) {
    if (e.detail !== 0) return
    if (kind === 'task') onTaskClick?.(id)
  }

  const isDragging = (kind: 'task' | 'project', id: string) => Boolean(drag && drag.kind === kind && drag.id === id)

  return (
    <div className="bg-surface rounded-[14px] shadow-card border border-border overflow-hidden">
      <div ref={scrollRef} className="overflow-x-auto" data-testid="gantt-scroll">
        <div style={{ width: LABEL_W + trackW }}>
          {/* Header */}
          <div className="flex border-b border-border bg-input-bg/60">
            <div
              className="sticky left-0 z-10 bg-input-bg shrink-0 border-r border-border px-4 py-2.5"
              style={{ width: LABEL_W, minWidth: LABEL_W }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.projectTask')}</span>
            </div>
            <div className="relative h-9" style={{ width: trackW }}>
              {months.map((tick) => (
                <div key={tick.iso} className="absolute top-0 h-full flex items-start pt-1" style={{ left: tick.offsetDays * px }}>
                  <div className="h-full w-px bg-border/50" />
                  <span className="text-[10px] font-semibold text-text-muted ml-1.5 whitespace-nowrap">{monthLabel(tick.iso)}</span>
                </div>
              ))}
              {days.map((tick) => (
                <span
                  key={tick.iso}
                  className="absolute bottom-0.5 text-[9px] text-text-muted"
                  style={{ left: tick.offsetDays * px + 2 }}
                >
                  {parseDate(tick.iso).getDate()}
                </span>
              ))}
              <div className="absolute top-0 h-full w-0.5 bg-accent/60" style={{ left: todayLeft }} />
            </div>
          </div>

          {/* Rows */}
          {projects.map((project) => {
            const projectTasks = tasks.filter((tk) => tk.project_id === project.id)
            const dated = projectTasks
              .map((tk) => ({ task: tk, range: entityRange(tk.start_date, tk.due_date) }))
              .filter((x): x is { task: GanttTask; range: DateRange } => x.range !== null)
              .sort((a, b) => a.range.start.localeCompare(b.range.start))
            const undated = projectTasks.filter((tk) => !tk.start_date && !tk.due_date)
            const baseProjectRange = entityRange(project.start_date, project.end_date)
            const color = STATUS_COLORS[project.status] ?? '#3e6b5a'
            const projectRange = baseProjectRange ? displayRange('project', project.id, baseProjectRange) : null
            const projectGeom = projectRange ? barGeometry(projectRange, range.start, px) : null
            const projectDragging = isDragging('project', project.id)

            return (
              <div key={project.id} className="border-b border-border last:border-0">
                {/* Project row */}
                <div className="flex items-stretch hover:bg-input-bg/30 transition-colors group">
                  <div
                    className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-3 flex items-center gap-2 min-w-0"
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[12px] font-semibold text-text-primary truncate">{project.name}</span>
                  </div>
                  <div className="relative h-10" style={{ width: trackW }}>
                    <TrackBg height={40} weekends={weekends} months={months} todayLeft={todayLeft} px={px} />
                    {projectRange && projectGeom && (
                      <div
                        role={editable && canEditProjects ? 'button' : undefined}
                        tabIndex={editable && canEditProjects ? 0 : undefined}
                        aria-label={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                        onPointerDown={(e) => beginDrag(e, 'project', project.id, baseProjectRange!)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 overflow-hidden select-none ${
                          editable && canEditProjects ? 'cursor-grab' : ''
                        } ${projectDragging ? 'ring-2 ring-accent/40' : ''}`}
                        style={{ left: projectGeom.left, width: projectGeom.width, backgroundColor: color + '22', border: `2px solid ${color}` }}
                        title={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                      >
                        {editable && canEditProjects && (
                          <>
                            <span data-edge="start" className="absolute left-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                            <span data-edge="end" className="absolute right-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                          </>
                        )}
                        <span className="text-[9px] font-semibold whitespace-nowrap truncate" style={{ color }}>
                          {fmt(projectRange.start)} – {fmt(projectRange.end)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dated task rows */}
                {dated.map(({ task, range: baseRange }) => {
                  const r = displayRange('task', task.id, baseRange)
                  const geom = barGeometry(r, range.start, px)
                  const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.todo
                  const dragging = isDragging('task', task.id)
                  return (
                    <div key={task.id} className="flex items-stretch hover:bg-input-bg/20 transition-colors">
                      <div
                        className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 pl-8 flex items-center gap-2 min-w-0"
                        style={{ width: LABEL_W, minWidth: LABEL_W }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-border" />
                        <span className="text-[11px] text-text-secondary truncate">{task.title}</span>
                      </div>
                      <div className="relative h-8" style={{ width: trackW }}>
                        <TrackBg height={32} weekends={weekends} months={months} todayLeft={todayLeft} px={px} />
                        <button
                          type="button"
                          aria-label={`${task.title}: ${fmt(r.start)} – ${fmt(r.end)}`}
                          onPointerDown={(e) => beginDrag(e, 'task', task.id, baseRange)}
                          onPointerMove={moveDrag}
                          onPointerUp={endDrag}
                          onClick={(e) => onBarClick(e, 'task', task.id)}
                          className={`absolute top-1/2 -translate-y-1/2 h-4 rounded flex items-center px-1.5 overflow-hidden select-none text-left ${
                            editable ? 'cursor-grab' : 'cursor-default'
                          } ${dragging ? 'ring-2 ring-accent/40' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
                          style={{ left: geom.left, width: geom.width, backgroundColor: colors.bg, border: `1.5px solid ${colors.border}` }}
                          title={`${task.title}: ${fmt(r.start)} – ${fmt(r.end)}`}
                        >
                          {editable && (
                            <>
                              <span data-edge="start" className="absolute left-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                              <span data-edge="end" className="absolute right-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                            </>
                          )}
                          <span className="text-[9px] font-medium whitespace-nowrap truncate pointer-events-none" style={{ color: colors.border }}>
                            {dragging ? `${fmt(r.start)} – ${fmt(r.end)}` : task.title}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Not-scheduled tray */}
                {undated.length > 0 && (
                  <div className="flex items-stretch" data-testid="tray">
                    <div
                      className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 pl-8 flex items-center min-w-0"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted truncate">
                        {t('timeline.notScheduled', { n: undated.length })}
                      </span>
                    </div>
                    <div className="sticky z-10 flex items-center gap-1.5 px-2 py-1.5 flex-wrap" style={{ left: LABEL_W }}>
                      {undated.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          disabled={!editable}
                          title={editable ? t('timeline.scheduleHint') : undefined}
                          onClick={() => {
                            if (!editable) return
                            onScheduleTask?.(task.id, { start_date: today, due_date: addDays(today, 6) })
                          }}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-dashed border-border text-text-secondary bg-input-bg/40 hover:border-accent hover:text-accent transition-colors disabled:cursor-default disabled:hover:border-border disabled:hover:text-text-secondary"
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-input-bg/30 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.legend')}</span>
        {(['active', 'completed', 'on_hold'] as const).map((s) => {
          const labelKey = s === 'active' ? 'timeline.legendActive' : s === 'completed' ? 'timeline.legendCompleted' : 'timeline.legendOnHold'
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              <span className="text-[11px] text-text-secondary">{t(labelKey)}</span>
            </div>
          )
        })}
        <div className="w-px h-4 bg-border mx-1" />
        {(['done', 'in_progress', 'todo'] as const).map((s) => {
          const labelKey = s === 'done' ? 'timeline.legendDone' : s === 'in_progress' ? 'timeline.legendInProgress' : 'timeline.legendTodo'
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-8 h-2.5 rounded" style={{ backgroundColor: TASK_STATUS_COLORS[s].bg, border: `1.5px solid ${TASK_STATUS_COLORS[s].border}` }} />
              <span className="text-[11px] text-text-secondary">{t(labelKey)}</span>
            </div>
          )
        })}
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-4 bg-accent/60" />
          <span className="text-[11px] text-text-secondary">{t('timeline.today')}</span>
        </div>
        {editable && (
          <span className="ml-auto text-[10px] text-text-muted hidden md:inline">{t('timeline.dragHint')}</span>
        )}
      </div>
    </div>
  )
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/TimelineGantt.test.tsx`
Expected: PASS, 7 tests.

If "week zoom draws day numbers" fails because `getAllByText('1')` matches nothing, check the day-number `<span>`s render `parseDate(tick.iso).getDate()` as a number (React renders numbers fine); if it fails on multiple matches that is acceptable since `getAllByText` is used.

- [x] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors. If the hooks plugin flags anything in this file, fix it rather than suppressing it; `TrackBg` is deliberately top-level so the static-components rule stays quiet.

- [x] **Step 6: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/components/TimelineGantt.tsx freelance-tracker/src/components/TimelineGantt.test.tsx && git commit -m "feat(timeline): reusable TimelineGantt with pixel zoom, sticky labels, and not-scheduled tray

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Drag, resize, click, and Escape tests for `TimelineGantt`

The handlers already exist in Task 3's code. This task proves them with tests and fixes anything they reveal.

**Files:**
- Modify: `src/components/TimelineGantt.test.tsx`
- Modify (only if a test fails): `src/components/TimelineGantt.tsx`

- [x] **Step 1: Add the interaction tests**

Append to `src/components/TimelineGantt.test.tsx` (inside the file, after the first `describe`):

```tsx
describe('TimelineGantt drag', () => {
  const px = PX_PER_DAY.month

  function bar() {
    return screen.getByRole('button', { name: /Brand audit/ })
  }

  it('dragging a bar 3 days right saves both dates shifted by 3', async () => {
    const { onTaskDates } = setup()
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-13', due_date: '2026-09-15' })
  })

  it('dragging the end handle changes only the due date', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const endHandle = el.querySelector('[data-edge="end"]')!
    fireEvent.pointerDown(endHandle, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 2 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 2 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-10', due_date: '2026-09-14' })
  })

  it('dragging the start handle past the end clamps to a one-day bar', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const startHandle = el.querySelector('[data-edge="start"]')!
    fireEvent.pointerDown(startHandle, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 10 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 10 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-12', due_date: '2026-09-12' })
  })

  it('a movement under 3px is a click and opens the task instead of saving', () => {
    const { onTaskDates, onTaskClick } = setup()
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 102, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 102, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
    expect(onTaskClick).toHaveBeenCalledWith('t1')
  })

  it('Escape during a drag cancels without saving and restores the position', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 5 * px, pointerId: 1 })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(el, { clientX: 100 + 5 * px, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
    expect(bar().style.left).toBe(before)
  })

  it('reverts to the original position when the save rejects', async () => {
    const onTaskDates = vi.fn().mockRejectedValue(new Error('RLS denied'))
    setup({ onTaskDates })
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalled()
    await screen.findByRole('button', { name: /Brand audit/ }) // flush microtasks
    await new Promise((r) => setTimeout(r, 0))
    expect(bar().style.left).toBe(before)
  })

  it('read-only mode never calls onTaskDates on drag', () => {
    const { onTaskDates } = setup({ editable: false })
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
  })

  it('project bars only drag when canEditProjects is true', () => {
    const onProjectDates = vi.fn().mockResolvedValue(undefined)
    setup({ onProjectDates, canEditProjects: false })
    const el = screen.getByTitle(/ProSeries Marketing:/)
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onProjectDates).not.toHaveBeenCalled()
  })

  it('project bars drag when canEditProjects is true', () => {
    const onProjectDates = vi.fn().mockResolvedValue(undefined)
    setup({ onProjectDates, canEditProjects: true })
    const el = screen.getByTitle(/ProSeries Marketing:/)
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onProjectDates).toHaveBeenCalledWith('p1', { start_date: '2026-09-04', end_date: '2026-11-03' })
  })
})
```

- [x] **Step 2: Run the tests**

Run: `npx vitest run src/components/TimelineGantt.test.tsx`
Expected: PASS, 16 tests.

Known pitfalls if something fails:
- **`fireEvent.pointerDown` does not trigger the handler:** jsdom must expose `PointerEvent`. jsdom 29 does. If `button` arrives as `undefined`, change the guard in `beginDrag` to `if (e.button !== undefined && e.button !== 0) return`.
- **Escape test fails because pointerUp still commits:** ensure `endDrag` reads `dragRef.current` (cleared by the Escape handler), not the `drag` state.
- **Revert test fails:** the `finally` that deletes the override must run after the rejection; the two `await`s in the test flush it. If still flaky, wrap the final assertion in `await waitFor(() => expect(bar().style.left).toBe(before))` (import `waitFor` from Testing Library).

- [x] **Step 3: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/components/TimelineGantt.test.tsx freelance-tracker/src/components/TimelineGantt.tsx && git commit -m "test(timeline): drag, resize, clamp, click, escape, and revert behaviour

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Workspace role hook and `OwnerGate`

Done before the page rewrite because the page reads the role.

**Files:**
- Create: `src/hooks/useWorkspaceRole.ts`
- Test: `src/hooks/useWorkspaceRole.test.ts`
- Rewrite: `src/components/OwnerGate.tsx`

- [x] **Step 1: Write the failing test for the pure resolver**

Create `src/hooks/useWorkspaceRole.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveRole, COLLABORATOR_PATHS, isCollaboratorPath } from './useWorkspaceRole'

describe('resolveRole', () => {
  it('owning any client makes you the owner regardless of other flags', () => {
    expect(resolveRole(true, true, true)).toBe('owner')
  })
  it('a member with no clients is a collaborator, even if also a portal client', () => {
    expect(resolveRole(false, true, true)).toBe('collaborator')
  })
  it('a portal client with nothing else is portal', () => {
    expect(resolveRole(false, false, true)).toBe('portal')
  })
  it('a brand-new account with nothing is owner (freelancer signup path)', () => {
    expect(resolveRole(false, false, false)).toBe('owner')
  })
})

describe('isCollaboratorPath', () => {
  it('allows only timeline and tasks routes', () => {
    expect(COLLABORATOR_PATHS).toEqual(['/timeline', '/tasks'])
    expect(isCollaboratorPath('/timeline')).toBe(true)
    expect(isCollaboratorPath('/timeline?project=x')).toBe(true)
    expect(isCollaboratorPath('/tasks')).toBe(true)
    expect(isCollaboratorPath('/')).toBe(false)
    expect(isCollaboratorPath('/invoices')).toBe(false)
    expect(isCollaboratorPath('/time')).toBe(false)
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useWorkspaceRole.test.ts`
Expected: FAIL — cannot resolve `./useWorkspaceRole`.

- [x] **Step 3: Implement the hook and context**

Create `src/hooks/useWorkspaceRole.ts`:

```ts
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type WorkspaceRole = 'owner' | 'collaborator' | 'portal'

/** Routes a collaborator may open. Everything else redirects to /timeline. */
export const COLLABORATOR_PATHS = ['/timeline', '/tasks'] as const

export function isCollaboratorPath(pathname: string): boolean {
  return COLLABORATOR_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

/**
 * Pure classifier. Owner wins because the RLS scoping for owned data is by
 * user_id; a member with no clients is a collaborator; a portal-only email is
 * a client; an account with nothing yet is a fresh freelancer signup.
 */
export function resolveRole(ownsClients: boolean, isMember: boolean, isPortalClient: boolean): WorkspaceRole {
  if (ownsClients) return 'owner'
  if (isMember) return 'collaborator'
  if (isPortalClient) return 'portal'
  return 'owner'
}

export const WorkspaceRoleContext = createContext<WorkspaceRole>('owner')

/** Read the role provided by OwnerGate. Defaults to 'owner' outside the gate (portal pages never call this). */
export function useRole(): WorkspaceRole {
  return useContext(WorkspaceRoleContext)
}

async function hasRows(table: string): Promise<boolean> {
  const { count, error } = await supabase.from(table).select('id', { head: true, count: 'exact' }).limit(1)
  if (error) return false
  return (count ?? 0) > 0
}

/** Runs the three head-count queries once per session and classifies the user. */
export function useWorkspaceRole(): { role: WorkspaceRole | null; loading: boolean } {
  const [role, setRole] = useState<WorkspaceRole | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([hasRows('clients'), hasRows('project_members'), hasRows('portal_clients')])
      .then(([owns, member, portal]) => {
        if (!cancelled) setRole(resolveRole(owns, member, portal))
      })
      .catch(() => {
        if (!cancelled) setRole('owner')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { role, loading: role === null }
}
```

- [x] **Step 4: Run the test**

Run: `npx vitest run src/hooks/useWorkspaceRole.test.ts`
Expected: PASS, 5 tests.

- [x] **Step 5: Rewrite `OwnerGate`**

Replace the whole of `src/components/OwnerGate.tsx` with:

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useWorkspaceRole, isCollaboratorPath, WorkspaceRoleContext } from '../hooks/useWorkspaceRole'

/**
 * Classifies the signed-in user and shapes the app around it:
 * - portal      → client; sent to /portal
 * - collaborator → invited on some projects; only /timeline and /tasks
 * - owner       → the freelancer; everything
 * The role is provided via context so Sidebar, WorkTabs, Layout, and pages can adapt.
 */
export default function OwnerGate({ children }: { children: ReactNode }) {
  const { role, loading } = useWorkspaceRole()
  const location = useLocation()

  if (loading || role === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }
  if (role === 'portal') return <Navigate to="/portal" replace />
  if (role === 'collaborator' && !isCollaboratorPath(location.pathname)) {
    return <Navigate to="/timeline" replace />
  }
  return <WorkspaceRoleContext.Provider value={role}>{children}</WorkspaceRoleContext.Provider>
}
```

- [x] **Step 6: Type-check and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: clean.

- [x] **Step 7: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/hooks/useWorkspaceRole.ts freelance-tracker/src/hooks/useWorkspaceRole.test.ts freelance-tracker/src/components/OwnerGate.tsx && git commit -m "feat(auth): workspace role (owner/collaborator/portal) with context and route gate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Rewrite the `/timeline` page

**Files:**
- Rewrite: `src/pages/Timeline.tsx`

- [x] **Step 1: Replace the page**

Replace the whole of `src/pages/Timeline.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, X } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useRole } from '../hooks/useWorkspaceRole'
import TimelineInsight from '../components/TimelineInsight'
import WorkTabs from '../components/WorkTabs'
import TimelineGantt from '../components/TimelineGantt'
import TaskForm, { type TaskFormData } from '../components/TaskForm'
import type { Zoom } from '../lib/timelineMath'
import { useI18n } from '../lib/i18n'

const ZOOMS: Zoom[] = ['week', 'month', 'quarter']
const ZOOM_KEY = 'timeline.zoom'
const REFRESH_MS = 60_000

function readZoom(): Zoom {
  try {
    const v = localStorage.getItem(ZOOM_KEY)
    return v === 'week' || v === 'month' || v === 'quarter' ? v : 'month'
  } catch {
    return 'month'
  }
}

function TimelineHero({ activeCount, endingSoon }: { activeCount: number; endingSoon: number }) {
  const { t } = useI18n()
  return (
    <div className="rounded-[16px] text-white relative overflow-hidden" style={{ backgroundColor: '#0a1223', minHeight: '160px' }}>
      <img
        src="/timeline-hero.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="sync"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center 35%' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(10,18,35,0.82) 0%, rgba(10,18,35,0.55) 60%, rgba(10,18,35,0.20) 100%)' }}
      />
      <div className="relative z-10 px-7 py-7 max-w-2xl">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[2px]">{t('timeline.yourRunway')}</p>
        <h1 className="text-[24px] font-bold tracking-[-0.4px] text-white mt-1.5">{t('timeline.title')}</h1>
        <p className="text-white/75 text-[13px] mt-2 leading-relaxed italic">{t('timeline.heroQuote')}</p>
        <p className="text-white/60 text-[12px] mt-3">
          {activeCount === 1 ? t('timeline.activeProject', { n: activeCount }) : t('timeline.activeProjects', { n: activeCount })}
          {endingSoon > 0 ? t('timeline.endingIn14', { n: endingSoon }) : ''}
        </p>
      </div>
    </div>
  )
}

export default function Timeline() {
  const { t } = useI18n()
  const role = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects, loading: projectsLoading, updateProject } = useProjects()
  const { tasks, loading: tasksLoading, updateTask, refetch: refetchTasks } = useTasks()

  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!projectsLoading && !tasksLoading) setReady(true)
  }, [projectsLoading, tasksLoading])

  const [zoom, setZoom] = useState<Zoom>(readZoom)
  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, zoom)
    } catch {
      /* private mode */
    }
  }, [zoom])

  const projectFilter = searchParams.get('project') ?? ''
  function setProjectFilter(id: string) {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('project', id)
    else next.delete('project')
    setSearchParams(next, { replace: true })
  }

  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(id)
  }, [error])

  // Two people may be editing: refresh on focus and every minute.
  useEffect(() => {
    const onFocus = () => {
      refetchTasks()
    }
    window.addEventListener('focus', onFocus)
    const id = setInterval(onFocus, REFRESH_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(id)
    }
  }, [refetchTasks])

  const [editingId, setEditingId] = useState<string | null>(null)
  const editingTask = useMemo(() => tasks.find((tk) => tk.id === editingId) ?? null, [tasks, editingId])

  const visibleProjects = useMemo(
    () => (projectFilter ? projects.filter((p) => p.id === projectFilter) : projects),
    [projects, projectFilter],
  )
  const visibleTasks = useMemo(() => {
    const ids = new Set(visibleProjects.map((p) => p.id))
    return tasks.filter((tk) => ids.has(tk.project_id))
  }, [tasks, visibleProjects])

  function failMessage(err: unknown): string {
    return t('timeline.saveFailed', { error: err instanceof Error ? err.message : String(err) })
  }

  async function saveTaskDates(id: string, dates: { start_date: string; due_date: string }) {
    try {
      await updateTask(id, dates)
    } catch (err) {
      setError(failMessage(err))
      throw err
    }
  }

  async function saveProjectDates(id: string, dates: { start_date: string; end_date: string }) {
    try {
      await updateProject(id, dates)
    } catch (err) {
      setError(failMessage(err))
      throw err
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const activeCount = projects.filter((p) => p.status === 'active').length
  const endingSoon = projects.filter((p) => {
    if (p.status !== 'active' || !p.end_date) return false
    const days = Math.ceil((new Date(p.end_date + 'T00:00:00').getTime() - today.getTime()) / 86400000)
    return days >= 0 && days <= 14
  }).length

  return (
    <div className="p-6 flex flex-col gap-5">
      <TimelineHero activeCount={activeCount} endingSoon={endingSoon} />
      <WorkTabs />
      {role === 'owner' && <TimelineInsight projects={projects} tasks={tasks} />}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-[12px] text-text-secondary">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.filterProject')}</span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">{t('timeline.allProjects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.zoomLabel')}</span>
          <div role="radiogroup" aria-label={t('timeline.zoomLabel')} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            {ZOOMS.map((z) => {
              const key = z === 'week' ? 'timeline.zoomWeek' : z === 'month' ? 'timeline.zoomMonth' : 'timeline.zoomQuarter'
              const active = z === zoom
              return (
                <button
                  key={z}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setZoom(z)}
                  className={`px-2.5 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                    active ? 'text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                  style={active ? { background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' } : undefined}
                >
                  {t(key)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-negative-bg text-negative rounded-[12px] px-4 py-2.5 text-[12px]">
          <AlertCircle size={14} />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="p-1 rounded hover:bg-negative/10">
            <X size={12} />
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-surface rounded-[14px] shadow-card border border-border p-12 flex items-center justify-center">
          <p className="text-text-muted text-[13px]">{t('timeline.empty')}</p>
        </div>
      ) : (
        <TimelineGantt
          projects={visibleProjects}
          tasks={visibleTasks}
          zoom={zoom}
          editable
          canEditProjects={role === 'owner'}
          onTaskDates={saveTaskDates}
          onProjectDates={saveProjectDates}
          onScheduleTask={saveTaskDates}
          onTaskClick={(id) => setEditingId(id)}
        />
      )}

      <TaskForm
        open={editingTask !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        task={
          editingTask
            ? {
                id: editingTask.id,
                title: editingTask.title,
                description: editingTask.description ?? undefined,
                status: editingTask.status,
                priority: editingTask.priority,
                startDate: editingTask.start_date ?? undefined,
                dueDate: editingTask.due_date ?? undefined,
                projectId: editingTask.project_id,
              }
            : null
        }
        onSave={async (data: TaskFormData) => {
          if (!editingTask) return
          await updateTask(editingTask.id, {
            title: data.title,
            description: data.description ?? null,
            status: data.status,
            priority: data.priority,
            start_date: data.startDate ?? null,
            due_date: data.dueDate ?? null,
          })
          setEditingId(null)
        }}
      />
    </div>
  )
}
```

- [x] **Step 2: Type-check, lint, and run the whole suite**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npx vitest run`
Expected: clean; all tests pass (23 existing + 23 + 16 + 5 = 67).

If `TaskForm`'s `task.status`/`priority` types complain (they are declared as `string` in `TaskFormProps`), the code above already passes the narrower union, which is assignable. If `useSearchParams` typing complains about `new URLSearchParams(searchParams)`, use `new URLSearchParams(searchParams.toString())`.

- [ ] **Step 3: Smoke-run the page in the browser**

Start the dev server (use the `run` skill or `npm run dev`), open `http://localhost:5173/timeline`, sign in with the existing test account, and confirm:
- Rows render for every project including ones without dates.
- Zoom buttons change the scale and the view auto-scrolls near today.
- Dragging a task bar moves it and the new dates persist after a reload.
- Clicking a bar opens the task dialog.
- The project filter narrows the rows and updates the URL.

Take one screenshot at 1440 wide and save it to `~/dev/freelancetracker/freelance-tracker/verify/2026-09-01-timeline-month.png` (create the folder if needed; it is fine to commit it, matching the repo's habit of committing screenshots).

- [x] **Step 4: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/pages/Timeline.tsx freelance-tracker/verify && git commit -m "feat(timeline): drag-editable planner page with zoom, project filter, task dialog, and periodic refresh

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Navigation — Work → Timeline, tab order, "Open timeline" button

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/WorkTabs.tsx`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/ProjectDetail.tsx` (header button row, ~line 335)

- [x] **Step 1: Sidebar**

In `src/components/Sidebar.tsx`:

1. Change the lucide import to add two icons:

```ts
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Briefcase,
  BookOpen,
  Wallet,
  Calendar,
  Plus,
  Mail,
  GanttChartSquare,
  CheckSquare,
} from 'lucide-react'
```

2. Add the role import after the i18n import:

```ts
import { useRole } from '../hooks/useWorkspaceRole'
```

3. Change the Work entry in `navItems` from `to: '/tasks'` to `to: '/timeline'`:

```ts
  { to: '/timeline', label: 'Work', icon: Briefcase, matchAny: ['/tasks', '/timeline', '/time'] },
```

4. Directly below `navItems`, add:

```ts
const collaboratorItems: NavItem[] = [
  { to: '/timeline', labelKey: 'nav.timeline', label: 'Timeline', icon: GanttChartSquare },
  { to: '/tasks', labelKey: 'nav.tasks', label: 'Tasks', icon: CheckSquare },
]
```

5. Inside the component, after `const { t } = useI18n()`, add:

```ts
  const role = useRole()
  const items = role === 'collaborator' ? collaboratorItems : navItems
```

6. Change `{navItems.map((item) => {` to `{items.map((item) => {`.

7. Wrap the Quick Create block so it is owner-only: change `<div className="px-2.5 pb-4 pt-2 mt-auto border-t border-sidebar-border">` … `</div>` to be rendered as `{role !== 'collaborator' && ( ...that div... )}`.

- [x] **Step 2: WorkTabs**

Replace the whole of `src/components/WorkTabs.tsx` with:

```tsx
import { NavLink } from 'react-router-dom'
import { CheckSquare, GanttChartSquare, Clock } from 'lucide-react'
import { useRole } from '../hooks/useWorkspaceRole'

/**
 * Shared sub-nav for the consolidated "Work" surface.
 * Mounted at the top of /timeline, /tasks, and /time. Timeline comes first
 * because it is the planning home; collaborators never see the Timer.
 */
export default function WorkTabs() {
  const role = useRole()
  const tabs = [
    { to: '/timeline', label: 'Timeline', icon: GanttChartSquare },
    { to: '/tasks', label: 'List', icon: CheckSquare },
    ...(role === 'collaborator' ? [] : [{ to: '/time', label: 'Timer', icon: Clock }]),
  ]
  return (
    <div className="flex items-center gap-1 border-b border-border -mb-px">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `relative flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors ${
              isActive ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <t.icon size={13} strokeWidth={isActive ? 2 : 1.5} />
              {t.label}
              {isActive && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full" />}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}
```

- [x] **Step 3: BottomNav**

In `src/components/BottomNav.tsx`:

1. Extend the lucide import with `GanttChartSquare, CheckSquare`.
2. Add `import { useRole } from '../hooks/useWorkspaceRole'`.
3. Below `navItems`, add:

```ts
const collaboratorItems = [
  { to: '/timeline', labelKey: 'nav.timeline', icon: GanttChartSquare },
  { to: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
]
```

4. Inside the component after `const { t } = useI18n()`, add `const role = useRole()` and `const items = role === 'collaborator' ? collaboratorItems : navItems`.
5. Change `{navItems.map((item) => {` to `{items.map((item) => {`.

- [x] **Step 4: Layout — no quick-log for collaborators**

In `src/components/Layout.tsx`:

1. Add `import { useRole } from '../hooks/useWorkspaceRole'`.
2. Inside the component, first line: `const role = useRole()` and `const canLogTime = role !== 'collaborator'`.
3. In the keyboard effect, change the quick-log branch to `if (canLogTime && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {` and add `canLogTime` to the effect's dependency array: `}, [canLogTime])`.
4. Change `<QuickLogDialog open={quickLogOpen} onOpenChange={setQuickLogOpen} />` to `{canLogTime && <QuickLogDialog open={quickLogOpen} onOpenChange={setQuickLogOpen} />}`.

- [x] **Step 5: ProjectDetail "Open timeline" button**

In `src/pages/ProjectDetail.tsx`, add `GanttChartSquare` to the lucide import on line 3. Then in the header button row (the `<div className="flex items-center gap-2 shrink-0">` that holds the Edit and Delete buttons, ~line 335), insert **before** the Edit button:

```tsx
            <Link
              to={`/timeline?project=${project.id}`}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-text-secondary text-[12px] font-medium hover:bg-input-bg transition-colors"
            >
              <GanttChartSquare size={12} />
              {t('projectDetail.openTimeline')}
            </Link>
```

`Link` is already imported on line 2.

- [x] **Step 6: Type-check, lint, tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npx vitest run`
Expected: clean, 67 tests pass.

- [ ] **Step 7: Browser check**

With the dev server running as owner: the sidebar "Work" lands on `/timeline`; the tabs read Timeline · List · Timer; a project page shows "Open timeline" and it opens the filtered timeline.

- [x] **Step 8: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/components/Sidebar.tsx freelance-tracker/src/components/WorkTabs.tsx freelance-tracker/src/components/BottomNav.tsx freelance-tracker/src/components/Layout.tsx freelance-tracker/src/pages/ProjectDetail.tsx && git commit -m "feat(nav): timeline is the Work landing; collaborator shell; open-timeline link on project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Database migration for collaborators

**Files:**
- Create: `supabase_migration_project_members.sql`

- [x] **Step 1: Write the migration**

Create `freelance-tracker/supabase_migration_project_members.sql`:

```sql
-- FreelanceTracker: project collaborators
-- Spec: docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md
--
-- Lets the owner invite an email to edit tasks on ONE project. Access is
-- email-based (like the client portal) so invites can precede signup.
--
-- Touches RLS on exactly two tables: projects (members may SELECT) and tasks
-- (members may do everything on tasks of their projects; the owner's policy
-- becomes project-based so collaborator-created tasks stay visible to the owner).
-- Every other table keeps its owner-only policy. Portal views are unaffected.
--
-- Supabase's linter will flag is_project_member() as SECURITY DEFINER. That is
-- intentional: it must read project_members without that table's RLS.

BEGIN;

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (btrim(email) <> ''),
  role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by  UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The app lower-cases and trims email before insert; the index is the guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_project_email
  ON public.project_members (project_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_project_members_email_lower
  ON public.project_members (lower(email));

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 2. Membership check (definer: bypasses project_members RLS) ---------------
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = p_project_id
      AND lower(m.email) = lower(auth.jwt()->>'email')
  );
$$;
REVOKE ALL ON FUNCTION public.is_project_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID) TO authenticated;

-- 3. project_members policies -----------------------------------------------
DROP POLICY IF EXISTS owner_manages_members ON public.project_members;
CREATE POLICY owner_manages_members ON public.project_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS member_sees_own_row ON public.project_members;
CREATE POLICY member_sees_own_row ON public.project_members
  FOR SELECT
  USING (lower(email) = lower(auth.jwt()->>'email'));

-- 4. projects: members may read (writes stay owner-only via users_own_projects)
DROP POLICY IF EXISTS members_read_projects ON public.projects;
CREATE POLICY members_read_projects ON public.projects
  FOR SELECT
  USING (public.is_project_member(id));

-- 5. tasks: owner access becomes project-based; members get full task access
DROP POLICY IF EXISTS users_own_tasks ON public.tasks;
CREATE POLICY users_own_tasks ON public.tasks
  FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS members_manage_tasks ON public.tasks;
CREATE POLICY members_manage_tasks ON public.tasks
  FOR ALL
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

GRANT SELECT, INSERT, DELETE ON public.project_members TO authenticated;

COMMIT;
```

- [x] **Step 2: Commit the file (not yet applied)**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/supabase_migration_project_members.sql && git commit -m "feat(db): project_members table, is_project_member(), and collaborator RLS on projects/tasks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [x] **Step 3: CHECKPOINT — ask Reggie before applying**

This migration changes production RLS (the app has no separate staging database). Stop and ask Reggie, in chat, for explicit approval to apply `supabase_migration_project_members.sql` to Supabase project `pnilvktjzpnyqhnowuhs`. Do not proceed to Step 4 without a clear yes.

- [x] **Step 4: Apply (after approval)**

Either paste the file into the Supabase SQL editor, or use the Supabase MCP `apply_migration` tool with name `project_members` and the file's contents. Expected: success, no errors.

- [x] **Step 5: Verify the policies exist**

Run in the SQL editor (or via MCP `execute_sql`):

```sql
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('project_members', 'projects', 'tasks') ORDER BY 1, 2;
```

Expected rows include `owner_manages_members`, `member_sees_own_row`, `members_read_projects`, `users_own_projects`, `members_manage_tasks`, `users_own_tasks`.

---

### Task 9: `useProjectMembers` hook and Collaborators card

**Files:**
- Create: `src/hooks/useProjectMembers.ts`
- Test: `src/hooks/useProjectMembers.test.ts`
- Create: `src/components/ProjectCollaboratorsCard.tsx`
- Modify: `src/pages/ProjectDetail.tsx` (insert before `<Tabs`, ~line 413)

- [x] **Step 1: Write the failing test for email normalisation**

Create `src/hooks/useProjectMembers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeEmail } from './useProjectMembers'

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Colleague@Example.COM ')).toBe('colleague@example.com')
  })
  it('rejects things that are not emails', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('nope')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a b@c.com')).toBeNull()
  })
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useProjectMembers.test.ts`
Expected: FAIL — cannot resolve `./useProjectMembers`.

- [x] **Step 3: Implement the hook**

Create `src/hooks/useProjectMembers.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ProjectMember {
  id: string
  project_id: string
  email: string
  role: 'editor'
  created_at: string
}

/** Trim + lower-case; null when it is not a plausible email. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** Thrown by addMember so the UI can map to a translated message. */
export type AddMemberError = 'invalid' | 'duplicate'

export function useProjectMembers(projectId: string | undefined) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setMembers((data ?? []) as ProjectMember[])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const addMember = useCallback(
    async (rawEmail: string): Promise<void> => {
      if (!projectId) return
      const email = normalizeEmail(rawEmail)
      if (!email) throw new Error('invalid' satisfies AddMemberError)
      const { error: err } = await supabase.from('project_members').insert({ project_id: projectId, email })
      if (err) {
        if (err.code === '23505') throw new Error('duplicate' satisfies AddMemberError)
        throw err
      }
      await fetchMembers()
    },
    [projectId, fetchMembers],
  )

  const removeMember = useCallback(
    async (id: string): Promise<void> => {
      const { error: err } = await supabase.from('project_members').delete().eq('id', id)
      if (err) throw err
      setMembers((prev) => prev.filter((m) => m.id !== id))
    },
    [],
  )

  return { members, loading, error, addMember, removeMember, refetch: fetchMembers }
}
```

- [x] **Step 4: Run the test**

Run: `npx vitest run src/hooks/useProjectMembers.test.ts`
Expected: PASS, 2 tests.

- [x] **Step 5: Create the card component**

Create `src/components/ProjectCollaboratorsCard.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Loader2, UserPlus, X, Users } from 'lucide-react'
import { useProjectMembers } from '../hooks/useProjectMembers'
import { useI18n } from '../lib/i18n'

interface Props {
  projectId: string
}

/** Owner-only card: who can add and edit tasks on this project. */
export default function ProjectCollaboratorsCard({ projectId }: Props) {
  const { t } = useI18n()
  const { members, loading, addMember, removeMember } = useProjectMembers(projectId)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addMember(email)
      setEmail('')
    } catch (err) {
      const m = err instanceof Error ? err.message : ''
      setError(m === 'duplicate' ? t('collab.duplicate') : m === 'invalid' ? t('collab.invalidEmail') : m || t('collab.failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface rounded-[14px] shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-accent" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('collab.title')}</p>
      </div>
      <p className="text-text-muted text-[12px]">{t('collab.desc')}</p>

      {loading ? (
        <Loader2 size={16} className="animate-spin text-accent" />
      ) : members.length === 0 ? (
        <p className="text-text-muted text-[12px]">{t('collab.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 bg-input-bg/50 rounded-[10px] px-3 py-2">
              <span className="text-[12px] text-text-primary truncate">{m.email}</span>
              <button
                type="button"
                onClick={() => removeMember(m.id).catch((err) => setError(err instanceof Error ? err.message : t('collab.failed')))}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-negative transition-colors"
                aria-label={`${t('collab.remove')} ${m.email}`}
              >
                <X size={12} />
                {t('collab.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('collab.emailPlaceholder')}
          aria-label={t('collab.emailPlaceholder')}
          className="flex-1 h-9 rounded-lg border border-border bg-input-bg px-3 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={saving || email.trim() === ''}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-[12px] font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
        >
          <UserPlus size={12} />
          {t('collab.add')}
        </button>
      </form>
      {error && <p className="text-negative text-[11px]">{error}</p>}
    </div>
  )
}
```

- [x] **Step 6: Mount the card on ProjectDetail**

In `src/pages/ProjectDetail.tsx`:
1. Add `import ProjectCollaboratorsCard from '../components/ProjectCollaboratorsCard'` after the `EmailSyncButton` import.
2. Find the line that begins `      <Tabs` (the tab strip below the header/stat cards, ~line 413). Insert immediately **before** it, at the same indentation:

```tsx
      <ProjectCollaboratorsCard projectId={project.id} />
```

The page is owner-only (collaborators are redirected away from `/projects/*`), so no role check is needed here.

- [x] **Step 7: Type-check, lint, tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npx vitest run`
Expected: clean, 69 tests pass.

- [ ] **Step 8: Browser check (needs the migration from Task 8 applied)**

On a project page as owner: the Collaborators card shows "No collaborators yet"; adding `test.colleague@example.com` lists it; adding it again shows the duplicate message; Remove deletes it.

- [x] **Step 9: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/hooks/useProjectMembers.ts freelance-tracker/src/hooks/useProjectMembers.test.ts freelance-tracker/src/components/ProjectCollaboratorsCard.tsx freelance-tracker/src/pages/ProjectDetail.tsx && git commit -m "feat(collab): project collaborators hook and owner card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Client portal timeline

**Files:**
- Modify: `src/pages/Portal.tsx`

- [x] **Step 1: Add the view toggle and the read-only Gantt**

In `src/pages/Portal.tsx`:

1. Change the first import line to `import { useMemo, useState } from 'react'`.
2. Add `import TimelineGantt from '../components/TimelineGantt'` after the `PortalLayout` import.
3. Above `export default function Portal()`, add:

```tsx
type PortalView = 'timeline' | 'list'
const VIEW_KEY = 'portal.view'

function readView(): PortalView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'timeline'
  } catch {
    return 'timeline'
  }
}
```

4. Inside the component, after `const ordered = useMemo(...)`, add:

```tsx
  const [view, setViewState] = useState<PortalView>(readView)
  function setView(v: PortalView) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode */
    }
  }
```

5. Replace the block that starts with `<p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px] mb-5">` (the "Your Projects" caption) with a row holding the caption and the toggle:

```tsx
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">{t('portal.yourProjects')}</p>
        <div role="radiogroup" aria-label={t('portal.yourProjects')} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {(['timeline', 'list'] as const).map((v) => {
            const active = v === view
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setView(v)}
                className={`px-2.5 h-7 rounded-md text-[11px] font-semibold transition-colors ${active ? 'text-white' : 'text-text-muted hover:text-text-primary'}`}
                style={active ? { background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' } : undefined}
              >
                {t(v === 'timeline' ? 'portal.viewTimeline' : 'portal.viewList')}
              </button>
            )
          })}
        </div>
      </div>
```

6. Wrap the existing `<div className="flex flex-col gap-5">` … `</div>` that maps `ordered` (the list of project cards) so it only renders in list view, and add the timeline branch before it:

```tsx
      {ordered.length > 0 && view === 'timeline' && (
        <TimelineGantt
          projects={ordered.map((p) => ({ id: p.id, name: p.name, status: p.status, start_date: p.start_date, end_date: p.end_date }))}
          tasks={tasks.map((tk) => ({ id: tk.id, project_id: tk.project_id, title: tk.title, status: tk.status, start_date: tk.start_date, due_date: tk.due_date }))}
          zoom="month"
          editable={false}
        />
      )}

      {view === 'list' && (
        <div className="flex flex-col gap-5">
          {/* existing ordered.map(...) content, unchanged */}
        </div>
      )}
```

Keep the existing `ordered.length === 0` empty-state block as it is, above both branches.

- [x] **Step 2: Type-check, lint, tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint && npx vitest run`
Expected: clean, 69 tests pass.

- [ ] **Step 3: Browser check**

Open `http://localhost:5173/portal` in a private window and sign in with the magic link as a client email that exists in `clients` (the earlier portal verification used one; ask Reggie if unknown). Confirm the Timeline toggle is default, bars render, nothing is draggable, and List shows the old cards. Screenshot at 1440 → `verify/2026-09-01-portal-timeline.png`.

- [x] **Step 4: Commit**

```bash
cd ~/dev/freelancetracker && git add freelance-tracker/src/pages/Portal.tsx freelance-tracker/verify && git commit -m "feat(portal): read-only timeline view with list toggle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Security verification with a second account

Requires Task 8 applied. No code changes unless a check fails.

- [ ] **Step 1: Invite a test collaborator**

As owner, on one project (call it SHARED), add the email of a second test account. Keep another project (UNSHARED) with no members. Note SHARED's id and UNSHARED's id from the URL.

- [ ] **Step 2: Sign up the collaborator**

In a private window, sign up at `/` with that email and confirm via the email link (email confirmation must be ON in Supabase Auth). Note the new user's auth UID from Supabase Dashboard → Authentication → Users.

- [ ] **Step 3: Verify the UI as collaborator**

Signed in as the collaborator:
- Lands on `/timeline`; sidebar shows only Timeline and Tasks; no quick-create; tabs show Timeline · List only.
- Only SHARED appears. Dragging a SHARED task saves and survives reload.
- Creating a task from `/tasks` on SHARED works; the owner then sees it (check as owner).
- Typing `/invoices`, `/`, `/time`, `/projects/<SHARED id>` into the URL redirects to `/timeline`.
- Project bar has no grab cursor and cannot be dragged.
Screenshot the collaborator's timeline at 1440 → `verify/2026-09-01-collaborator-timeline.png`.

- [x] **Step 4: Verify RLS directly in SQL**

In the Supabase SQL editor, replace the placeholders and run:

```sql
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"<COLLAB_UID>","email":"<collab email>","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT count(*) AS shared_tasks   FROM public.tasks WHERE project_id = '<SHARED id>';   -- > 0
SELECT count(*) AS unshared_tasks FROM public.tasks WHERE project_id = '<UNSHARED id>'; -- 0
SELECT count(*) AS projects       FROM public.projects;                                 -- 1
SELECT count(*) AS clients        FROM public.clients;                                  -- 0
SELECT count(*) AS time_entries   FROM public.time_entries;                             -- 0
SELECT count(*) AS invoices       FROM public.invoices;                                 -- 0
SELECT count(*) AS expenses       FROM public.expenses;                                 -- 0
UPDATE public.projects SET name = name WHERE id = '<SHARED id>';                        -- UPDATE 0
INSERT INTO public.tasks (project_id, user_id, title, status, priority, assignee)
  VALUES ('<UNSHARED id>', '<COLLAB_UID>', 'should fail', 'todo', 'medium', 'me');     -- ERROR: new row violates row-level security
ROLLBACK;
```

Every comment on the right is the expected result. If any differs, stop and fix the migration before continuing.

- [ ] **Step 5: Revocation**

As owner, remove the collaborator from SHARED. As the collaborator, reload `/timeline`: the workspace-role check now finds zero member rows, so the account resolves to `owner` with an empty workspace (this is the "fresh signup" branch and is acceptable). Confirm SHARED's tasks are gone.

- [x] **Step 6: Record**

Append a short "Security verification 2026-09-01" section with the SQL results to the bottom of `docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md` and commit:

```bash
cd ~/dev/freelancetracker && git add docs freelance-tracker/verify && git commit -m "docs: record collaborator RLS verification

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Visual review, build, and wrap-up

- [ ] **Step 1: Screenshots**

With the dev server running as owner, capture and save under `freelance-tracker/verify/`:
- `2026-09-01-timeline-week.png`, `-month.png`, `-quarter.png` at 1440 wide
- `2026-09-01-timeline-1920.png` (month) and `2026-09-01-timeline-375.png` (month, mobile)
- `2026-09-01-timeline-drag.png` mid-drag (use the browser tool: pointer down, move, screenshot, then release)
- `2026-09-01-project-collaborators.png` (the card on a project page)

- [ ] **Step 2: Write the critique**

Look at every screenshot and write a real critique (per CLAUDE.md) into `freelance-tracker/verify/2026-09-01-critique.md`: what reads well, what is cramped, whether bar labels truncate badly at quarter zoom, whether the sticky label column has a visible seam while scrolling, whether the 375 view is usable (horizontal scroll inside the card, tray chips wrapping). Fix anything that is clearly wrong (spacing, truncation, contrast) in `TimelineGantt.tsx`, re-screenshot, and note the fix.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean, 69 tests pass, `vite build` completes with the PWA manifest generated.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/freelancetracker && git add -A freelance-tracker/verify freelance-tracker/src && git commit -m "chore(timeline): visual review screenshots and polish

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand-off**

Do **not** push or merge. Report to Reggie: what was built, the migration status, the security results, the screenshots, and that `/app-review` is the next gate before shipping (per CLAUDE.md). Update the memory file `freelancetracker-project-state.md` with the branch name and status.

---

### Task 13: Per-project timeline with Overview

Done 2026-09-02, after Reggie's visual review of `/timeline` with real data (18 projects,
122 mostly one-day tasks) rejected the stacked-everything Gantt. The page now shows one
project at a time, chosen with a switcher row above the grid (an Overview chip, chips for
the recently updated active projects, and a compact select covering every project), with
the selection held in `?project=<id>` / `?project=all` and mirrored to
`localStorage['timeline.lastProject']`. Overview is the one multi-project view: one bar
per project, no task rows, the owner-only insight banner, and a muted hint explaining the
mode. Default zoom moved from Month to Week so one-day tasks are grabbable. The selection
rules are a pure module so they are testable without the DOM; `TimelineGantt` itself was
not touched.

- [x] New `src/lib/timelineSelection.ts`: `OVERVIEW`, `resolveSelection(param, stored, projects)` (param → stored → newest active → newest of any status → Overview, re-validating both stored and URL values against the loaded projects), and `quickPickProjects(projects, selectedId, max = 6)` (newest active first, capped, always including the current selection).
- [x] `src/lib/timelineSelection.test.ts`: 21 cases covering every fallback rule, empty-string and stale ids, an empty workspace, the cap, chip inclusion of a non-active or out-of-cap selection, no duplication, and no mutation of the input.
- [x] `src/pages/Timeline.tsx`: `<select>`-only filter replaced by the chip switcher plus a compact all-projects select (Overview option, projects grouped under the existing `timeline.allProjects` label, sorted by name); the selected chip carries `aria-current="true"`; chips and the zoom control share one `segmentClass` / gradient.
- [x] Selection resolved during render and synced to the URL with `replace: true` plus `localStorage`, all storage access wrapped in try/catch.
- [x] Per-project mode passes just that project and its tasks to `TimelineGantt`; Overview passes every project and `tasks={[]}`; `TimelineInsight` renders only in Overview.
- [x] `readZoom` default changed from `'month'` to `'week'`.
- [x] i18n: `timeline.overview` and `timeline.overviewHint` added to both dictionaries after `timeline.allProjects`; `timeline.allProjects` kept, now the select's optgroup label.
- [x] `src/pages/Timeline.test.tsx`: the six existing tests kept (the stale-`?project=` one rewritten for the new fallback, the zoom one switched to Quarter since Week is now the default), plus new tests for the opening selection and its URL/localStorage writes, Overview's bars/hint/insight and absent task bars, chip switching, and the Week default.
- [x] Verified: `npx tsc -p tsconfig.app.json --noEmit` clean, `npm run lint` 0 errors, `npx vitest run` 159 tests passing.
- [x] Design doc updated: "Navigation", "Page behaviour (`/timeline`)", and a "Revision 2026-09-02 — one project at a time" note.

#### Follow-up, same day: readable, content-driven, printable

A second review of `/timeline` with the same real data (18 projects, 122 mostly one-day
tasks with long bracketed titles) raised four more problems: the grid opened scrolled to
today while the selected project's work was months earlier, so every visible track was
empty; the 220 px label column clipped titles at ~25 characters; done tasks buried the
live ones; and there was no way to put the plan on paper or in front of a client.

- [x] `src/lib/timelineMath.ts`: new `computeContentRange(dates, today)` — min(earliest valid date, today) − 7 .. max(latest valid date, today) + 14, same ISO validation and same `MAX_SPAN_DAYS` clamp toward today as `computeRange`, falling back to `computeRange([], today)` when nothing is dated. `computeRange` kept and refactored onto the shared `dateBounds` / `padAndClamp` helpers, so its behaviour is unchanged.
- [x] `src/lib/timelineMath.ts`: new `initialScrollDay(range, dates, today)` — today's offset when today lies inside [earliest, latest], the earliest date's offset otherwise, clamped to ≥ 0.
- [x] `src/lib/timelineMath.test.ts`: 13 new cases covering the fallback, invalid-only input, past-only and future-only content, the clamps, and every `initialScrollDay` branch including the never-negative rule.
- [x] `TimelineGantt` builds its range with `computeContentRange` and auto-scrolls `initialScrollDay(...) * px` to ~15% from the left of the track on mount and zoom change; the `lastZoomRef` guard, drag, overrides, and the props handoff are untouched.
- [x] Default `labelWidth` 220 → 320; project and task label cells wrap to two lines (`line-clamp-2 whitespace-normal leading-snug break-words`) and keep a `title` with the full text; rows use `min-h-[40px]` / `min-h-[32px]` tracks under `flex items-stretch` instead of fixed `h-10` / `h-8`, so a two-line label grows its row and the bar stays centred. The portal still passes 150 and now wraps as well.
- [x] Editable bars are rendered at a minimum 16 px wide (`Math.max(width, MIN_BAR_PX)` on `style.width` only, commented in place); drag geometry keeps using the true width so a widened sliver never lies about the dates it saves. Read-only bars keep their true width.
- [x] `src/components/TimelineGantt.test.tsx`: the day-offset test now computes its expectation with `computeContentRange`, as does the prop-handoff test; new tests for a past-only range starting a week before the earliest task and for read-only bars keeping their true width; the one-day-bar test now asserts the 16 px floor; `getByTitle` queries anchored to `/^Title:/` now that label cells carry a `title` too.
- [x] `src/pages/Timeline.tsx`: "Hide done" checkbox pill beside the zoom control, default on, persisted in `localStorage['timeline.hideDone']` (only `'false'` turns it off), with a muted `{n} done hidden` count when any are hidden. Done tasks are filtered out before `TimelineGantt` sees them; Overview is unaffected because it passes no tasks.
- [x] `src/pages/Timeline.tsx`: "Print / PDF" button (lucide `Printer`) calling `window.print()`, and a `hidden print:block` header above the Gantt with the project name (or "Overview"), the visible range as `MMM d, yyyy – MMM d, yyyy` (from the same `computeContentRange` inputs the Gantt uses), and the print date.
- [x] `src/index.css`: `@media print` block — `[data-print-hide]` display:none (sidebar, top bar, bottom nav, sidebar spacer, hero, WorkTabs, insight banner, controls row, Overview hint, drag hint), `main` padding/overflow reset, `overflow: visible` on the Gantt and its scroll container, `position: static` on sticky label cells, `break-inside: avoid` on `.gantt-row`, `print-color-adjust: exact` on `.gantt-bar` and weekend shading, `zoom: var(--print-scale)` (set from React as `min(1, 1000 / (labelWidth + trackW))`), and `@page { size: landscape; margin: 12mm }`.
- [x] `data-print-hide` added to `Sidebar`, `TopBar`, `BottomNav`, and the `Layout` sidebar spacer — attribute only, no behaviour change on screen.
- [x] i18n: `timeline.hideDone`, `timeline.doneHidden`, `timeline.print`, `timeline.printedOn` added to both dictionaries beside the other `timeline.*` keys.
- [x] `src/pages/Timeline.test.tsx`: new tests for the default hide (with the count), the absent count when nothing is done, un-ticking the toggle (restores the bars and writes `'false'`), honouring a stored `'false'`, and a smoke test that Print calls a mocked `window.print`.
- [x] Verified: `npx tsc -p tsconfig.app.json --noEmit` clean, `npm run lint` 0 errors (21 pre-existing warnings, unchanged), `npx vitest run` 179 tests passing (was 159).

### Task 14: Milestones layer

Started 2026-09-02 after the owner's visual review, using Milestones PM+ as the reference:
Projects → Milestones → Tasks, a Gantt drawn at milestone level with tasks nested and
collapsed by default, shared by print/PDF and the client portal. The owner's data already
encodes phases as bracketed title prefixes (52 of 122 tasks, 7 distinct prefixes in one
project), so a one-time backfill turns those prefixes into real milestones and strips them
from the titles. Spec: "Revision 2026-09-02 (b) — Milestones layer" in the design doc.
Four steps; the migrations are files only — Reggie applies them after reviewing.

- [x] **Step 1 — schema, portal view, types, hook, helpers.**
  - [x] `supabase_migration_milestones.sql`: `public.milestones` (project cascade, `user_id` defaulting to `auth.uid()`, non-blank name, optional ordered dates, `sort_order`, timestamps), `tasks.milestone_id → milestones(id) ON DELETE SET NULL`, indexes `idx_tasks_milestone_id` and `idx_milestones_project_sort`, RLS with `owner_manages_milestones` + `members_manage_milestones` and deliberately no `auth.uid() = user_id` clause (same lesson as the tasks policies), the new definer view `portal_milestones`, `portal_tasks` recreated with `milestone_id` appended last, and the grants. No `updated_at` trigger: the repo has no such function, so the app sets the column.
  - [x] `supabase_migration_milestones_from_prefixes.sql`: one-time, owner-run backfill — a milestone per `(project, ^[prefix])` group with the group's min/max task dates and its rank as `sort_order`, then the tasks linked and their prefixes stripped, ending in a SELECT reporting milestones, linked tasks, and any task still prefixed.
  - [x] `src/hooks/useTasks.ts`: `Task.milestone_id`, optional in `TaskInsert`.
  - [x] `src/hooks/useMilestones.ts`: `Milestone` / `MilestoneInsert` / `MilestoneUpdate` and `useMilestones(projectId?)` — ordered by `sort_order` then `start_date`, all milestones when no project id, `isCancelled` guard, PGRST205 treated as an empty list, `updateMilestone` sending `updated_at` and replacing the returned row, `deleteMilestone` using `.select('id')` and throwing `'failed'` on an empty result.
  - [x] `src/lib/milestones.ts`: `milestoneRange`, `milestoneProgress`, `groupTasksByMilestone`, `sortMilestones` — pure, structural types so both `Task` and `PortalTask` fit.
  - [x] `src/lib/portal.ts` + `src/hooks/usePortalData.ts`: `PortalMilestone`, `PortalTask.milestone_id`, and a fourth read of `portal_milestones` whose PGRST205 is swallowed so the portal keeps working before the migration.
  - [x] Tests: `src/lib/milestones.test.ts` (11) and `src/hooks/useMilestones.test.ts` (6, mocked query builder).
  - [x] Verified: `npx tsc -p tsconfig.app.json --noEmit` clean, `npm run lint` 0 errors (21 pre-existing warnings, unchanged), `npx vitest run` 196 tests passing (was 179).
- [ ] **Step 2 — Gantt.** `milestones` prop, milestone rows with chevron, `done/total` and a progress-filled bar spanning its own dates or its tasks' extent, tasks nested one level and collapsed by default, "Unassigned" group only when the project has milestones, drag/resize when editable, Overview diamonds at milestone end dates, hide-done still hides tasks only.
- [ ] **Step 3 — page and forms.** "+ Milestone" button and dialog (name, start, end, delete) on `/timeline`, expansion state per project in `localStorage['timeline.expanded.<projectId>']`, `TaskForm` milestone select passed from the Timeline page, i18n keys in both dictionaries.
- [ ] **Step 4 — portal, print, and the prefix migration.** Portal Gantt renders milestones read-only with working collapse, print reflects what is displayed, then Reggie applies both migrations and the backfill is verified against the real data.
