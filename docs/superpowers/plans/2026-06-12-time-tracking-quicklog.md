# Time Tracking Quick-Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hidden manual time-entry form with a one-line quick-log bar (project chips, description autocomplete, smart defaults) and make the same form available from any page via `Ctrl+Shift+L` and a command-palette action.

**Architecture:** A pure logic module (`src/lib/quickLog.ts`) derives recent-project ordering and description suggestions from already-fetched time entries. A pure form component (`QuickLogForm`) consumes that logic and is rendered two ways: inline on the Time page, and inside a Radix dialog (`QuickLogDialog`) mounted in `Layout`. The existing `CommandPalette` gains action items. No database or schema changes.

**Tech Stack:** React 19 + TypeScript + Vite 8, Tailwind 4, Radix dialog primitives (existing `ui/dialog.tsx`), Supabase via existing `useTimeEntries`/`useProjects` hooks, Vitest + Testing Library (added in Task 1).

**Spec:** `docs/superpowers/specs/2026-06-12-time-tracking-quicklog-design.md`

**Working directory for all commands:** `C:\Users\Reggie\dev\freelancetracker\freelance-tracker` (the app subfolder — note `.npmrc` already sets `legacy-peer-deps=true`).

**Conventions to follow:**
- i18n: every user-visible string goes through `t('quickLog.…')`; keys must be added to BOTH the `en` and `es` dicts in `src/lib/i18n.tsx`. Interpolation uses `{var}` placeholders (see `'timeTracker.failedToLoad': 'Failed to load entries: {error}'`).
- Styling: match existing tokens — `bg-surface rounded-[14px] shadow-card`, `text-text-muted`, `bg-accent`, label style `text-[10px] font-semibold uppercase tracking-wide text-text-muted`.
- Imports: app code uses both `'../lib/x'` and `'@/components/ui/x'` aliases; follow the file you're editing.
- Do NOT push to GitHub. Commit locally only.

---

### Task 1: Vitest + Testing Library harness

The repo has no test framework (README lists it as open work). Install Vitest with jsdom and Testing Library, wire a `test` script and a CI job.

**Files:**
- Modify: `freelance-tracker/package.json` (devDependencies + `test` script)
- Create: `freelance-tracker/vitest.config.ts`
- Create: `freelance-tracker/src/test/setup.ts`
- Create: `freelance-tracker/src/test/smoke.test.ts`
- Modify: `.github/workflows/ci.yml` (repo root — add `test` job)

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Add the test script**

In `freelance-tracker/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

(Separate config rather than extending `vite.config.ts` so the PWA plugin never runs in tests. Tests import `describe/it/expect` from `'vitest'` explicitly — no `globals: true`, no tsconfig changes.)

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Create a smoke test `src/test/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 7: Verify build still passes (test files must not break `tsc -b`)**

Run: `npm run build`
Expected: success. If `tsc` complains about test files, add `"src/test"` and `"src/**/*.test.*"` to the `exclude` of `tsconfig.app.json` and create `tsconfig.vitest.json` is NOT needed — Vitest type-checks via its own transform; excluding from the app tsconfig is sufficient.

- [ ] **Step 8: Add CI test job**

In `.github/workflows/ci.yml`, add alongside the existing jobs (same checkout/node-setup shape as `lint`):

```yaml
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: freelance-tracker/package-lock.json
      - run: npm ci --legacy-peer-deps
      - run: npm test
```

- [ ] **Step 9: Commit**

```bash
git add freelance-tracker/package.json freelance-tracker/package-lock.json freelance-tracker/vitest.config.ts freelance-tracker/src/test ../.github/workflows/ci.yml
git commit -m "chore(test): add Vitest + Testing Library harness and CI job"
```

---

### Task 2: Quick-log logic module (TDD)

Pure functions, no React, no Supabase. This is the brain of the feature.

**Files:**
- Create: `freelance-tracker/src/lib/quickLog.ts`
- Test: `freelance-tracker/src/lib/quickLog.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/quickLog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { roundQuarterHour, recentProjects, descriptionSuggestions, type EntryLike } from './quickLog'

const projects = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
]

function entry(over: Partial<EntryLike>): EntryLike {
  return {
    project_id: 'a',
    description: 'work',
    hours: 1,
    date: '2026-06-01',
    created_at: '2026-06-01T10:00:00Z',
    ...over,
  }
}

describe('roundQuarterHour', () => {
  it('rounds up to the nearest 0.25', () => {
    expect(roundQuarterHour(1.01)).toBe(1.25)
    expect(roundQuarterHour(0.1)).toBe(0.25)
  })
  it('leaves exact quarters alone', () => {
    expect(roundQuarterHour(2)).toBe(2)
    expect(roundQuarterHour(1.75)).toBe(1.75)
  })
})

describe('recentProjects', () => {
  it('orders projects by most recently logged-against', () => {
    const entries = [
      entry({ project_id: 'b', date: '2026-06-10' }),
      entry({ project_id: 'a', date: '2026-06-08' }),
      entry({ project_id: 'b', date: '2026-06-01' }),
    ]
    expect(recentProjects(entries, projects).map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('breaks same-date ties by created_at', () => {
    const entries = [
      entry({ project_id: 'a', date: '2026-06-10', created_at: '2026-06-10T09:00:00Z' }),
      entry({ project_id: 'b', date: '2026-06-10', created_at: '2026-06-10T17:00:00Z' }),
    ]
    expect(recentProjects(entries, projects)[0].id).toBe('b')
  })

  it('appends never-logged projects in given order and respects max', () => {
    expect(recentProjects([], projects, 2).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('ignores entries for unknown (deleted) projects', () => {
    const entries = [entry({ project_id: 'zombie', date: '2026-06-11' })]
    expect(recentProjects(entries, projects).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('descriptionSuggestions', () => {
  const entries = [
    entry({ project_id: 'a', description: 'Homepage copy', hours: 2, date: '2026-06-10' }),
    entry({ project_id: 'a', description: 'homepage copy', hours: 3, date: '2026-06-01' }), // dup, older
    entry({ project_id: 'a', description: 'Client call', hours: 0.5, date: '2026-06-09' }),
    entry({ project_id: 'b', description: 'Other project work', hours: 1, date: '2026-06-11' }),
    entry({ project_id: 'a', description: null, date: '2026-06-08' }),
  ]

  it('returns recent-first deduped suggestions for the selected project only', () => {
    const s = descriptionSuggestions(entries, 'a', '')
    expect(s).toEqual([
      { description: 'Homepage copy', hours: 2 },
      { description: 'Client call', hours: 0.5 },
    ])
  })

  it('filters by query, case-insensitive', () => {
    expect(descriptionSuggestions(entries, 'a', 'home')).toEqual([
      { description: 'Homepage copy', hours: 2 },
    ])
  })

  it('omits a suggestion identical to the query', () => {
    expect(descriptionSuggestions(entries, 'a', 'Homepage copy')).toEqual([])
  })

  it('respects max', () => {
    expect(descriptionSuggestions(entries, 'a', '', 1)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './quickLog'` (or equivalent).

- [ ] **Step 3: Implement `src/lib/quickLog.ts`**

```ts
export interface ProjectRef {
  id: string
  name: string
}

/** Structural subset of hooks/useTimeEntries' TimeEntry — keeps this module React/Supabase-free. */
export interface EntryLike {
  project_id: string
  description: string | null
  hours: number
  date: string
  created_at: string
}

export interface Suggestion {
  description: string
  hours: number
}

/** Round up to the nearest 0.25h — same rule TimeEntryForm has always applied. */
export function roundQuarterHour(hours: number): number {
  return Math.ceil(hours * 4) / 4
}

function byRecency(a: EntryLike, b: EntryLike): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date)
  return b.created_at.localeCompare(a.created_at)
}

/**
 * Projects ordered by most recently logged-against; projects never logged
 * against follow in their given order. Capped at max.
 */
export function recentProjects(entries: EntryLike[], projects: ProjectRef[], max = 5): ProjectRef[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const out: ProjectRef[] = []
  const seen = new Set<string>()

  for (const e of [...entries].sort(byRecency)) {
    if (out.length >= max) return out
    if (seen.has(e.project_id)) continue
    const p = byId.get(e.project_id)
    if (p) {
      out.push(p)
      seen.add(p.id)
    }
  }
  for (const p of projects) {
    if (out.length >= max) break
    if (!seen.has(p.id)) {
      out.push(p)
      seen.add(p.id)
    }
  }
  return out
}

/**
 * Deduped, recent-first description suggestions for one project, filtered by
 * the text typed so far. Selecting one also pre-fills its hours.
 */
export function descriptionSuggestions(
  entries: EntryLike[],
  projectId: string,
  query: string,
  max = 8,
): Suggestion[] {
  const q = query.trim().toLowerCase()
  const out: Suggestion[] = []
  const seen = new Set<string>()

  for (const e of [...entries].sort(byRecency)) {
    if (out.length >= max) break
    if (e.project_id !== projectId) continue
    const description = (e.description ?? '').trim()
    if (!description) continue
    const key = description.toLowerCase()
    if (seen.has(key)) continue
    if (q && (!key.includes(q) || key === q)) continue
    out.push({ description, hours: e.hours })
    seen.add(key)
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quickLog.ts src/lib/quickLog.test.ts
git commit -m "feat(time): quick-log logic — recent projects, description suggestions, quarter-hour rounding"
```

---

### Task 3: i18n keys (en + es)

**Files:**
- Modify: `freelance-tracker/src/lib/i18n.tsx` (both `en` and `es` dicts)

- [ ] **Step 1: Add to the `en` dict** (insert a `// Quick Log` block near the existing `// Time` keys, e.g. after the `timeTracker.*` group around line 488):

```ts
  // Quick Log
  'quickLog.title': 'Log time',
  'quickLog.project': 'Project',
  'quickLog.moreProjects': 'More…',
  'quickLog.description': 'Description',
  'quickLog.descPh': 'What did you work on?',
  'quickLog.hours': 'Hours',
  'quickLog.date': 'Date',
  'quickLog.today': 'Today',
  'quickLog.yesterday': 'Yesterday',
  'quickLog.billable': 'Billable',
  'quickLog.moreOptions': 'More options',
  'quickLog.task': 'Task (optional)',
  'quickLog.add': 'Add',
  'quickLog.adding': 'Adding…',
  'quickLog.added': 'Added',
  'quickLog.saveFailed': 'Could not save entry: {error}',
  'quickLog.noProjects': 'No projects yet.',
  'quickLog.createProject': 'Create a project',
  'quickLog.logAgain': 'Log again',
  'quickLog.paletteAction': 'Log time…',
  'quickLog.suggestionsLabel': 'Recent descriptions',
```

- [ ] **Step 2: Add to the `es` dict** (mirror position, near `timeTracker.*` around line 1937):

```ts
  // Quick Log
  'quickLog.title': 'Registrar tiempo',
  'quickLog.project': 'Proyecto',
  'quickLog.moreProjects': 'Más…',
  'quickLog.description': 'Descripción',
  'quickLog.descPh': '¿En qué trabajaste?',
  'quickLog.hours': 'Horas',
  'quickLog.date': 'Fecha',
  'quickLog.today': 'Hoy',
  'quickLog.yesterday': 'Ayer',
  'quickLog.billable': 'Facturable',
  'quickLog.moreOptions': 'Más opciones',
  'quickLog.task': 'Tarea (opcional)',
  'quickLog.add': 'Agregar',
  'quickLog.adding': 'Agregando…',
  'quickLog.added': 'Agregado',
  'quickLog.saveFailed': 'No se pudo guardar la entrada: {error}',
  'quickLog.noProjects': 'Aún no hay proyectos.',
  'quickLog.createProject': 'Crear un proyecto',
  'quickLog.logAgain': 'Registrar de nuevo',
  'quickLog.paletteAction': 'Registrar tiempo…',
  'quickLog.suggestionsLabel': 'Descripciones recientes',
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.tsx
git commit -m "feat(i18n): quickLog strings (en, es)"
```

---

### Task 4: QuickLogForm component (TDD)

The capture form. Pure component: takes `projects`, `entries`, optional `tasks`, and `onSave`; owns no data fetching. Used inline on the Time page and inside the global dialog.

**Files:**
- Create: `freelance-tracker/src/components/QuickLogForm.tsx`
- Test: `freelance-tracker/src/components/QuickLogForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/QuickLogForm.test.tsx`. `useI18n` requires a provider, so every render is wrapped in `I18nProvider` from `../lib/i18n` (defaults to English).

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../lib/i18n'
import QuickLogForm from './QuickLogForm'
import type { EntryLike } from '../lib/quickLog'

const projects = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
]

const entries: EntryLike[] = [
  { project_id: 'b', description: 'Homepage copy', hours: 2, date: '2026-06-10', created_at: '2026-06-10T10:00:00Z' },
  { project_id: 'a', description: 'Logo sketches', hours: 1.5, date: '2026-06-08', created_at: '2026-06-08T10:00:00Z' },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <I18nProvider>
      <QuickLogForm projects={projects} entries={entries} onSave={onSave} />
    </I18nProvider>,
  )
  return onSave
}

describe('QuickLogForm', () => {
  it('renders recent-project chips with the most recently used pre-selected', () => {
    setup()
    const chips = screen.getByRole('radiogroup', { name: /project/i })
    const all = within(chips).getAllByRole('radio')
    expect(all[0]).toHaveAccessibleName('Beta') // most recent entry is project b
    expect(all[0]).toBeChecked()
  })

  it('submits with smart defaults: today, billable, rounded hours', async () => {
    const user = userEvent.setup()
    const onSave = setup()
    await user.type(screen.getByPlaceholderText(/what did you work on/i), 'New work')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '1.1')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onSave).toHaveBeenCalledWith({
      projectId: 'b',
      description: 'New work',
      hours: 1.25,
      date: todayISO(),
      billable: true,
      taskId: null,
    })
  })

  it('clears description and hours but keeps project after save', async () => {
    const user = userEvent.setup()
    setup()
    const desc = screen.getByPlaceholderText(/what did you work on/i)
    await user.type(desc, 'New work')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '2')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(desc).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked()
  })

  it('clicking a description suggestion fills description and hours', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('radio', { name: 'Alpha' }))
    await user.click(screen.getByPlaceholderText(/what did you work on/i))
    await user.click(await screen.findByRole('option', { name: /logo sketches/i }))
    expect(screen.getByPlaceholderText(/what did you work on/i)).toHaveValue('Logo sketches')
    expect(screen.getByRole('spinbutton', { name: /hours/i })).toHaveValue(1.5)
  })

  it('shows the error and preserves values when save fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    setup(onSave)
    const desc = screen.getByPlaceholderText(/what did you work on/i)
    await user.type(desc, 'Doomed')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '1')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(desc).toHaveValue('Doomed')
  })

  it('sets the date to yesterday via the Yesterday pill', async () => {
    const user = userEvent.setup()
    const onSave = setup()
    await user.click(screen.getByRole('button', { name: /yesterday/i }))
    await user.type(screen.getByPlaceholderText(/what did you work on/i), 'Late log')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '1')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterdayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(onSave.mock.calls[0][0].date).toBe(yesterdayISO)
  })

  it('shows an empty state when there are no projects', () => {
    render(
      <I18nProvider>
        <QuickLogForm projects={[]} entries={[]} onSave={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './QuickLogForm'`.

- [ ] **Step 3: Implement `src/components/QuickLogForm.tsx`**

```tsx
import { useMemo, useRef, useState } from 'react'
import { Plus, Check, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '../lib/i18n'
import {
  recentProjects,
  descriptionSuggestions,
  roundQuarterHour,
  type EntryLike,
  type ProjectRef,
} from '../lib/quickLog'

export interface QuickLogData {
  projectId: string
  description: string
  hours: number
  date: string
  billable: boolean
  taskId: string | null
}

interface QuickLogFormProps {
  projects: ProjectRef[]
  entries: EntryLike[]
  tasks?: { id: string; title: string }[]
  onSave: (data: QuickLogData) => Promise<void>
  /** Called after a successful save (the dialog uses this to close). */
  onSaved?: () => void
  autoFocus?: boolean
}

const MAX_CHIPS = 5

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function QuickLogForm({ projects, entries, tasks, onSave, onSaved, autoFocus }: QuickLogFormProps) {
  const { t } = useI18n()
  const [chosenProjectId, setChosenProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(() => isoDaysAgo(0))
  const [billable, setBillable] = useState(true)
  const [taskId, setTaskId] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestIndex, setSuggestIndex] = useState(-1)
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chips = useMemo(() => recentProjects(entries, projects, MAX_CHIPS), [entries, projects])
  const overflow = useMemo(
    () => projects.filter((p) => !chips.some((c) => c.id === p.id)),
    [projects, chips],
  )
  // Default to the most recently logged-against project until the user picks one.
  const projectId = chosenProjectId || chips[0]?.id || ''

  const suggestions = useMemo(
    () => descriptionSuggestions(entries, projectId, description),
    [entries, projectId, description],
  )

  function applySuggestion(s: { description: string; hours: number }) {
    setDescription(s.description)
    setHours(String(s.hours))
    setSuggestOpen(false)
    setSuggestIndex(-1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !description || !hours) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        projectId,
        description,
        hours: roundQuarterHour(Number(hours)),
        date,
        billable,
        taskId: taskId || null,
      })
      setDescription('')
      setHours('')
      setTaskId('')
      setSuggestOpen(false)
      setSuggestIndex(-1)
      setSaved(true)
      if (savedTimeout.current) clearTimeout(savedTimeout.current)
      savedTimeout.current = setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-4 text-[12px] text-text-muted">
        {t('quickLog.noProjects')}{' '}
        <a href="/projects" className="text-accent font-semibold hover:underline">
          {t('quickLog.createProject')}
        </a>
      </div>
    )
  }

  const todayISO = isoDaysAgo(0)
  const yesterdayISO = isoDaysAgo(1)

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-[14px] shadow-card p-4 flex flex-col gap-3">
      {/* Project chips */}
      <div role="radiogroup" aria-label={t('quickLog.project')} className="flex flex-wrap items-center gap-1.5">
        {chips.map((p) => {
          const active = p.id === projectId
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChosenProjectId(p.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
              }`}
            >
              {p.name}
            </button>
          )
        })}
        {overflow.length > 0 && (
          <Select value="" onValueChange={(v) => setChosenProjectId(v)}>
            <SelectTrigger
              aria-label={t('quickLog.moreProjects')}
              className="h-7 w-auto rounded-full border-0 bg-input-bg px-3 text-[11px] font-semibold text-text-muted"
            >
              <SelectValue placeholder={t('quickLog.moreProjects')} />
            </SelectTrigger>
            <SelectContent>
              {overflow.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Capture row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Description + suggestions */}
        <div className="relative flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.description')}
          </label>
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSuggestOpen(true)
              setSuggestIndex(-1)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            onKeyDown={(e) => {
              if (!suggestOpen || suggestions.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSuggestIndex((i) => Math.min(i + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSuggestIndex((i) => Math.max(i - 1, -1))
              } else if (e.key === 'Enter' && suggestIndex >= 0) {
                e.preventDefault()
                applySuggestion(suggestions[suggestIndex])
              } else if (e.key === 'Escape') {
                setSuggestOpen(false)
                setSuggestIndex(-1)
              }
            }}
            placeholder={t('quickLog.descPh')}
            required
            autoFocus={autoFocus}
            className="h-9 text-[12px]"
            role="combobox"
            aria-expanded={suggestOpen && suggestions.length > 0}
            aria-autocomplete="list"
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label={t('quickLog.suggestionsLabel')}
              className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-border rounded-[10px] shadow-card overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li key={s.description}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === suggestIndex}
                    onMouseEnter={() => setSuggestIndex(i)}
                    onMouseDown={(e) => e.preventDefault() /* keep input focus */}
                    onClick={() => applySuggestion(s)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12px] ${
                      i === suggestIndex ? 'bg-input-bg' : 'hover:bg-input-bg/60'
                    }`}
                  >
                    <span className="text-text-primary truncate">{s.description}</span>
                    <span className="text-text-muted shrink-0 ml-3">{s.hours}h</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hours */}
        <div className="flex flex-col gap-1 w-[80px]">
          <label htmlFor="quicklog-hours" className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.hours')}
          </label>
          <Input
            id="quicklog-hours"
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0.0"
            required
            className="h-9 text-[12px]"
          />
        </div>

        {/* Date: Today / Yesterday pills + picker */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.date')}
          </label>
          <div className="flex items-center gap-1.5">
            {[
              { label: t('quickLog.today'), value: todayISO },
              { label: t('quickLog.yesterday'), value: yesterdayISO },
            ].map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setDate(pill.value)}
                className={`h-9 px-3 rounded-[10px] text-[11px] font-semibold transition-all ${
                  date === pill.value
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                }`}
              >
                {pill.label}
              </button>
            ))}
            <Input
              type="date"
              aria-label={t('quickLog.date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[130px] text-[12px]"
            />
          </div>
        </div>

        {/* Billable */}
        <div className="flex flex-col gap-1 items-center">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.billable')}
          </label>
          <button
            type="button"
            role="checkbox"
            aria-checked={billable}
            aria-label={t('quickLog.billable')}
            onClick={() => setBillable(!billable)}
            className={`h-9 w-9 rounded-[10px] border transition-colors flex items-center justify-center ${
              billable ? 'bg-accent border-accent text-white' : 'bg-input-bg border-border text-text-muted'
            }`}
          >
            <Check size={14} className={billable ? 'opacity-100' : 'opacity-30'} />
          </button>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="gradient"
          size="sm"
          disabled={saving || !projectId || !description || !hours}
          className="h-9"
        >
          <Plus size={14} />
          {saving ? t('quickLog.adding') : saved ? t('quickLog.added') : t('quickLog.add')}
        </Button>
      </div>

      {/* More options (task picker) */}
      {tasks && tasks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-text-primary"
          >
            <ChevronDown size={12} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            {t('quickLog.moreOptions')}
          </button>
          {showMore && (
            <div className="mt-2 flex flex-col gap-1 max-w-[280px]">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {t('quickLog.task')}
              </label>
              <Select
                value={taskId}
                onValueChange={(val) => {
                  setTaskId(val)
                  if (val) {
                    const task = tasks.find((tk) => tk.id === val)
                    if (task) setDescription(task.title)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue placeholder={t('common.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.none')}</SelectItem>
                  {tasks.map((tk) => (
                    <SelectItem key={tk.id} value={tk.id}>
                      {tk.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-negative text-[12px]">{t('quickLog.saveFailed', { error })}</p>
      )}
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS. If the Radix `Select` in the chips row breaks jsdom rendering (Radix Select needs `hasPointerCapture` stubs in some versions), add to `src/test/setup.ts`:

```ts
// jsdom lacks pointer-capture APIs that Radix Select probes for
window.HTMLElement.prototype.hasPointerCapture ??= () => false
window.HTMLElement.prototype.setPointerCapture ??= () => {}
window.HTMLElement.prototype.releasePointerCapture ??= () => {}
window.HTMLElement.prototype.scrollIntoView ??= () => {}
```

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add src/components/QuickLogForm.tsx src/components/QuickLogForm.test.tsx src/test/setup.ts
git commit -m "feat(time): QuickLogForm — chips, description autocomplete, smart defaults"
```

---

### Task 5: Time page integration + visible "Log again"

Replace the hidden manual form with `QuickLogForm`; make the clone action a visible labeled button.

**Files:**
- Modify: `freelance-tracker/src/pages/TimeTracker.tsx`

- [ ] **Step 1: Swap in QuickLogForm**

In `src/pages/TimeTracker.tsx`:

1. Replace the import of `TimeEntryForm` with:

```ts
import QuickLogForm from '../components/QuickLogForm'
```

2. Delete the `showManualForm` state (line 16) and the toggle button block (the `{/* Toggle for manual entry form */}` div, lines 131–139) and the `{showManualForm && (<TimeEntryForm …/>)}` block (lines 141–144).

3. Where the toggle used to be (directly below `<Timer …/>`), render:

```tsx
<QuickLogForm
  projects={projectList}
  entries={entries}
  onSave={handleManualSave}
/>
```

4. Update `handleManualSave`'s signature to accept the new shape (it gains `taskId`):

```ts
const handleManualSave = useCallback(
  async (data: { projectId: string; description: string; hours: number; date: string; billable: boolean; taskId: string | null }) => {
    await createEntry({
      project_id: data.projectId,
      description: data.description,
      hours: data.hours,
      date: data.date,
      billable: data.billable,
      task_id: data.taskId,
      invoice_id: null,
    })
  },
  [createEntry],
)
```

(`createEntry` already accepts optional `task_id` via `TimeEntryInsert`.)

- [ ] **Step 2: Make "Log again" visible**

In the recent-entries table's actions cell (currently three icon-only buttons), replace the clone icon button with a labeled button (keep edit + delete icon buttons as they are):

```tsx
<button
  onClick={() => handleClone(entry)}
  className="px-2 py-1 rounded-[8px] text-[11px] font-semibold text-accent hover:bg-accent/10 transition-colors"
  title={t('timeTracker.cloneToToday')}
>
  {t('quickLog.logAgain')}
</button>
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: all clean. (`TimeEntryForm` is still imported by `ProjectDetail.tsx` — do NOT delete the component.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/TimeTracker.tsx
git commit -m "feat(time): quick-log bar replaces hidden manual form; visible Log-again action"
```

---

### Task 6: Global QuickLogDialog + Ctrl+Shift+L

**Files:**
- Create: `freelance-tracker/src/components/QuickLogDialog.tsx`
- Modify: `freelance-tracker/src/components/Layout.tsx`

- [ ] **Step 1: Create `src/components/QuickLogDialog.tsx`**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import QuickLogForm from './QuickLogForm'
import { useProjects } from '../hooks/useProjects'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useI18n } from '../lib/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Global "log time from anywhere" dialog (Ctrl+Shift+L / command palette). */
export default function QuickLogDialog({ open, onOpenChange }: Props) {
  const { t } = useI18n()
  const { projects } = useProjects()
  const { entries, createEntry } = useTimeEntries()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-[16px]">{t('quickLog.title')}</DialogTitle>
        </DialogHeader>
        <QuickLogForm
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          entries={entries}
          autoFocus
          onSave={async (data) => {
            await createEntry({
              project_id: data.projectId,
              description: data.description,
              hours: data.hours,
              date: data.date,
              billable: data.billable,
              task_id: data.taskId,
              invoice_id: null,
            })
          }}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

Note: `QuickLogForm` already renders its own card styling (`bg-surface rounded-[14px] shadow-card`); inside the dialog this nests fine visually, but if it looks double-carded during visual review, pass a className-less variant by editing `QuickLogForm`'s root to accept an optional `bare?: boolean` prop that drops `shadow-card` — only do this if the screenshot shows a problem.

- [ ] **Step 2: Wire into `Layout.tsx`**

Replace the keyboard-shortcut effect and add the dialog:

```tsx
import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import CommandPalette from './CommandPalette'
import QuickLogDialog from './QuickLogDialog'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickLogOpen, setQuickLogOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Global shortcuts: Cmd/Ctrl+K → search palette, Cmd/Ctrl+Shift+L → quick log
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setQuickLogOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  …
```

and in the JSX, after `<CommandPalette …/>`:

```tsx
      {/* Global quick-log dialog */}
      <QuickLogDialog open={quickLogOpen} onOpenChange={setQuickLogOpen} />
```

(Keep the rest of Layout unchanged. The Radix Dialog already closes on Esc; re-pressing Ctrl+Shift+L while open is a no-op because we only ever `setQuickLogOpen(true)`.)

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/QuickLogDialog.tsx src/components/Layout.tsx
git commit -m "feat(time): global quick-log dialog on Ctrl+Shift+L"
```

---

### Task 7: Command palette "Log time…" action

**Files:**
- Modify: `freelance-tracker/src/components/CommandPalette.tsx`
- Modify: `freelance-tracker/src/components/Layout.tsx`

- [ ] **Step 1: Extend the palette's result model**

In `src/components/CommandPalette.tsx`:

1. Add `Clock` to the lucide import.
2. Change the result types to a discriminated union and add the action to `KIND_META`:

```ts
interface NavResult {
  id: string
  label: string
  sublabel?: string
  to: string
  kind: 'project' | 'client' | 'task' | 'invoice' | 'meeting'
}

interface ActionResult {
  id: string
  label: string
  sublabel?: string
  kind: 'action'
  run: () => void
}

type SearchResult = NavResult | ActionResult

const KIND_META: Record<SearchResult['kind'], { icon: typeof FolderKanban; label: string; tone: string }> = {
  project: { icon: FolderKanban, label: 'Project', tone: 'text-accent' },
  client: { icon: Users, label: 'Client', tone: 'text-blue-500' },
  task: { icon: CheckSquare, label: 'Task', tone: 'text-emerald-600' },
  invoice: { icon: FileText, label: 'Invoice', tone: 'text-amber-500' },
  meeting: { icon: BookOpen, label: 'Meeting', tone: 'text-purple-500' },
  action: { icon: Clock, label: 'Action', tone: 'text-accent' },
}
```

3. Extend `Props`:

```ts
interface Props {
  open: boolean
  onClose: () => void
  onLogTime: () => void
}
```

(and destructure `onLogTime` in the component signature).

4. Inside the `results` memo, before the clients loop, prepend the action (it matches the empty query and log/time-ish queries). Add `t` via `useI18n()` (import `{ useI18n } from '../lib/i18n'`):

```ts
const actionLabel = t('quickLog.paletteAction')
const actionKeywords = ['log', 'time', 'hours', 'track', 'registrar', 'tiempo']
if (!q || actionKeywords.some((k) => k.startsWith(q) || q.startsWith(k)) || actionLabel.toLowerCase().includes(q)) {
  out.push({ id: 'action-log-time', label: actionLabel, kind: 'action', run: onLogTime })
}
```

and add `onLogTime` and `t` to the memo's dependency array.

5. Update both activation sites (Enter key handler and row `onClick`) from `navigate(r.to)` to:

```ts
if (r.kind === 'action') { r.run(); onClose() } else { navigate(r.to); onClose() }
```

(For the Enter handler, replace the existing `if (r) { navigate(r.to); onClose() }` accordingly; add `onLogTime` to that effect's dependency array too.)

- [ ] **Step 2: Pass the callback from Layout**

In `Layout.tsx`:

```tsx
<CommandPalette
  open={paletteOpen}
  onClose={() => setPaletteOpen(false)}
  onLogTime={() => { setPaletteOpen(false); setQuickLogOpen(true) }}
/>
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandPalette.tsx src/components/Layout.tsx
git commit -m "feat(palette): Log time… action opens global quick-log dialog"
```

---

### Task 8: Visual verification (evidence required)

Per operating conventions: screenshots + written critique before claiming done. No push/deploy in this task.

**Files:** none (verification only; fix-ups allowed)

- [ ] **Step 1: Start the dev server**

Run (from `freelance-tracker/`): `npm run dev` (background)
The app needs `.env.local` with real Supabase credentials; if missing, ask the user before proceeding — do not invent credentials.

- [ ] **Step 2: Capture and critique screenshots** (browser tooling — Chrome DevTools MCP or Playwright):

1. `/time` — quick-log bar default state: chips render, most-recent project pre-selected, Today pill active.
2. `/time` — description field focused with autocomplete suggestions open (needs existing entries).
3. `/time` — after submitting an entry: form cleared, "Added" confirmation on the button, new row in Recent Entries.
4. `/` (Dashboard) — press `Ctrl+Shift+L`: dialog opens with the same form; check for the double-card nesting issue flagged in Task 6.
5. `Ctrl+K` → palette shows "Log time…" action at top; type "log" and confirm it stays; Enter opens the dialog.
6. Recent Entries table — visible "Log again" button; click it and confirm a cloned entry appears dated today.

For each: look at the screenshot and write a real critique (alignment, spacing, contrast, wrapping at narrow width, Spanish strings via the language toggle). Fix anything broken, re-screenshot, commit fixes.

- [ ] **Step 3: Functional spot-checks**

- Hours `1.1` saves as `1.25` (check the new row).
- Yesterday pill produces yesterday's date on the saved entry.
- Esc closes the dialog; `Ctrl+Shift+L` while open does not double-open.
- Save with network failure (DevTools offline) shows the inline error and preserves values.

- [ ] **Step 4: Full gate**

Run: `npm run lint && npm run build && npm test`
Expected: all green.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(time): visual-review fixes for quick-log"
```

(Only if there are changes.)

---

## Out of scope (do not do)

- No push to GitHub, no Vercel deploy (user approval required first; `/app-review` runs before ship).
- No changes to `TimeEntryForm` usage on `ProjectDetail` (later pass).
- No schema/database changes.
- No mobile-specific work.
- Client portal — separate project.
