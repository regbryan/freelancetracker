# Client Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read-only client portal at `/portal` — magic-link sign-in, each client sees only their own projects and tasks, enforced by column-scoped database views.

**Architecture:** Three `security_invoker=false` views (`portal_clients`, `portal_projects`, `portal_tasks`) scope rows to the logged-in JWT email and expose only safe columns; base-table policies are untouched. The frontend adds a public `/portal` route (login → dashboard), a minimal `PortalLayout`, a `usePortalData` hook over the views, pure grouping helpers in `lib/portal.ts`, and an `OwnerGate` that redirects portal-only users out of the freelancer app.

**Tech Stack:** Supabase (Postgres views + Auth OTP), React 19 + TS + Vite, Tailwind tokens already in the app, Vitest + Testing Library (harness exists), i18n via `useI18n` (`{ t, lang, setLang }`).

**Spec:** `docs/superpowers/specs/2026-06-12-client-portal-design.md`
**Repo:** `C:\Users\Reggie\dev\freelancetracker` — work on branch `feature/client-portal` off `main`. npm commands run in `freelance-tracker/`. Commit locally; push only at the final ship task.

**Known facts** (verified):
- `useAuth()` → `{ user, loading, signUp, signIn, signOut }` (src/hooks/useAuth.ts).
- `useI18n()` → `{ t, lang, setLang }`.
- `Task.status` is `'todo' | 'in_progress' | 'done'`; `priority` is `'low' | 'medium' | 'high'`.
- i18n already has `status.todo`, `status.inProgress`, `status.done`, `status.active`, `status.completed`, `status.onHold`, `status.cancelled`, `common.loading` — reuse, don't duplicate.
- App routes: public routes sit above the `user ?` branch in src/App.tsx; pages lazy-load.
- Existing test auth user (confirmed, password known): `claude.uiverify.bough@gmail.com` / `QuickLog!2026verify`, with client "Acme Verify Co" + projects "Site Redesign", "Brand Refresh" + tasks none yet.

---

### Task 1: Portal views migration

**Files:**
- Create: `freelance-tracker/supabase_migration_client_portal.sql`

The controller (main session) applies it to the Supabase project `pnilvktjzpnyqhnowuhs` via the Supabase MCP `apply_migration` after the file is written and reviewed — the implementer subagent only writes the file and commits.

- [ ] **Step 1: Write the migration file**

```sql
-- FreelanceTracker: client portal read-only views
-- Spec: docs/superpowers/specs/2026-06-12-client-portal-design.md
--
-- Three definer views scope rows to the logged-in JWT email and expose ONLY
-- safe columns. Base-table RLS policies are untouched: portal users still get
-- zero rows from clients/projects/tasks directly. anon gets nothing at all.
-- Deliberately excluded: clients.notes/phone/hourly_rate, projects.hourly_rate/
-- monthly_rate/billing_type, tasks.assignee, every user_id.

BEGIN;

CREATE OR REPLACE VIEW public.portal_clients
WITH (security_invoker = false) AS
SELECT c.id, c.name, c.company
FROM public.clients c
WHERE lower(c.email) = lower(coalesce(auth.jwt()->>'email', ''));

CREATE OR REPLACE VIEW public.portal_projects
WITH (security_invoker = false) AS
SELECT p.id, p.client_id, p.name, p.description, p.status, p.start_date, p.end_date
FROM public.projects p
JOIN public.clients c ON c.id = p.client_id
WHERE lower(c.email) = lower(coalesce(auth.jwt()->>'email', ''));

CREATE OR REPLACE VIEW public.portal_tasks
WITH (security_invoker = false) AS
SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
       t.start_date, t.due_date, t.updated_at
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
JOIN public.clients c ON c.id = p.client_id
WHERE lower(c.email) = lower(coalesce(auth.jwt()->>'email', ''));

-- Definer semantics: run as the view owner (postgres), which bypasses base-table
-- RLS, so the WHERE clauses above are the entire access control. Lock the grants:
REVOKE ALL ON public.portal_clients,  public.portal_projects,  public.portal_tasks
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portal_clients, public.portal_projects, public.portal_tasks
  TO authenticated;

COMMIT;
```

- [ ] **Step 2: Sanity-read the file** — confirm every column list matches the spec table and no excluded column appears.

- [ ] **Step 3: Commit**

```bash
git add freelance-tracker/supabase_migration_client_portal.sql
git commit -m "feat(portal): client portal views migration (email-scoped, column-restricted)"
```

(Controller then applies the migration via MCP and runs the SQL spot-checks in Task 8 step 1.)

---

### Task 2: Portal grouping helpers (TDD)

**Files:**
- Create: `freelance-tracker/src/lib/portal.ts`
- Test: `freelance-tracker/src/lib/portal.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/lib/portal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupTasksByStatus, orderProjects, type PortalTask, type PortalProject } from './portal'

function task(over: Partial<PortalTask>): PortalTask {
  return {
    id: 'x', project_id: 'p', title: 'T', description: null,
    status: 'todo', priority: 'medium', start_date: null, due_date: null, updated_at: null,
    ...over,
  }
}

function project(over: Partial<PortalProject>): PortalProject {
  return {
    id: 'x', client_id: 'c', name: 'P', description: null,
    status: 'active', start_date: null, end_date: null,
    ...over,
  }
}

describe('groupTasksByStatus', () => {
  it('buckets tasks into todo / in_progress / done', () => {
    const g = groupTasksByStatus([
      task({ id: '1', status: 'done' }),
      task({ id: '2', status: 'todo' }),
      task({ id: '3', status: 'in_progress' }),
    ])
    expect(g.todo.map((t) => t.id)).toEqual(['2'])
    expect(g.in_progress.map((t) => t.id)).toEqual(['3'])
    expect(g.done.map((t) => t.id)).toEqual(['1'])
  })

  it('orders within a bucket by due_date ascending, undated last, ties by title', () => {
    const g = groupTasksByStatus([
      task({ id: 'a', title: 'Zeta', due_date: null }),
      task({ id: 'b', title: 'Alpha', due_date: '2026-07-01' }),
      task({ id: 'c', title: 'Beta', due_date: '2026-06-15' }),
      task({ id: 'd', title: 'Alpha', due_date: null }),
    ])
    expect(g.todo.map((t) => t.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('orderProjects', () => {
  it('orders active, completed, on_hold, cancelled; by name within a group', () => {
    const out = orderProjects([
      project({ id: '1', status: 'cancelled', name: 'A' }),
      project({ id: '2', status: 'active', name: 'B' }),
      project({ id: '3', status: 'on_hold', name: 'C' }),
      project({ id: '4', status: 'active', name: 'A' }),
      project({ id: '5', status: 'completed', name: 'D' }),
    ])
    expect(out.map((p) => p.id)).toEqual(['4', '2', '5', '3', '1'])
  })

  it('puts unknown statuses last without crashing', () => {
    const out = orderProjects([
      project({ id: '1', status: 'mystery' }),
      project({ id: '2', status: 'active' }),
    ])
    expect(out.map((p) => p.id)).toEqual(['2', '1'])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/lib/portal.ts`:

```ts
/** Row shapes returned by the portal_* database views. Pure module — no React/Supabase. */
export interface PortalClient {
  id: string
  name: string
  company: string | null
}

export interface PortalProject {
  id: string
  client_id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
}

export interface PortalTask {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  start_date: string | null
  due_date: string | null
  updated_at: string | null
}

export interface GroupedTasks {
  todo: PortalTask[]
  in_progress: PortalTask[]
  done: PortalTask[]
}

function byDueThenTitle(a: PortalTask, b: PortalTask): number {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date && !b.due_date) return -1
  if (!a.due_date && b.due_date) return 1
  return a.title.localeCompare(b.title)
}

export function groupTasksByStatus(tasks: PortalTask[]): GroupedTasks {
  const out: GroupedTasks = { todo: [], in_progress: [], done: [] }
  for (const t of tasks) out[t.status]?.push(t)
  out.todo.sort(byDueThenTitle)
  out.in_progress.sort(byDueThenTitle)
  out.done.sort(byDueThenTitle)
  return out
}

const PROJECT_STATUS_ORDER: Record<string, number> = {
  active: 0,
  completed: 1,
  on_hold: 2,
  cancelled: 3,
}

export function orderProjects(projects: PortalProject[]): PortalProject[] {
  return [...projects].sort((a, b) => {
    const ra = PROJECT_STATUS_ORDER[a.status] ?? 99
    const rb = PROJECT_STATUS_ORDER[b.status] ?? 99
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → all pass (previous 19 + 4 new).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/portal.ts src/lib/portal.test.ts
git commit -m "feat(portal): task grouping and project ordering helpers"
```

---

### Task 3: i18n portal strings (en + es)

**Files:**
- Modify: `freelance-tracker/src/lib/i18n.tsx` (BOTH dicts; insert a `// Portal` block after the `// Quick Log` block in each)

- [ ] **Step 1: en dict**

```ts
  // Portal
  'portal.title': 'Client Portal',
  'portal.signInPrompt': 'Enter your email to receive a sign-in link.',
  'portal.emailLabel': 'Email',
  'portal.sendLink': 'Send sign-in link',
  'portal.sending': 'Sending…',
  'portal.linkSent': 'Check your email — we sent you a sign-in link.',
  'portal.resend': 'Resend link',
  'portal.resendIn': 'Resend in {s}s',
  'portal.sendFailed': 'Could not send the link: {error}',
  'portal.signOut': 'Sign out',
  'portal.noAccessTitle': 'No portal found for this email',
  'portal.noAccessBody': 'There is no client workspace associated with {email}. If you believe this is a mistake, contact the freelancer who invited you.',
  'portal.yourProjects': 'Your Projects',
  'portal.noProjects': 'No projects yet.',
  'portal.noTasks': 'No tasks yet.',
  'portal.due': 'Due {date}',
  'portal.failedToLoad': 'Failed to load your portal: {error}',
  'portal.retry': 'Retry',
  'portal.greeting': 'Welcome, {name}',
```

- [ ] **Step 2: es dict** (mirror position)

```ts
  // Portal
  'portal.title': 'Portal de Clientes',
  'portal.signInPrompt': 'Ingresa tu correo para recibir un enlace de acceso.',
  'portal.emailLabel': 'Correo electrónico',
  'portal.sendLink': 'Enviar enlace de acceso',
  'portal.sending': 'Enviando…',
  'portal.linkSent': 'Revisa tu correo — te enviamos un enlace de acceso.',
  'portal.resend': 'Reenviar enlace',
  'portal.resendIn': 'Reenviar en {s}s',
  'portal.sendFailed': 'No se pudo enviar el enlace: {error}',
  'portal.signOut': 'Cerrar sesión',
  'portal.noAccessTitle': 'No hay portal para este correo',
  'portal.noAccessBody': 'No hay un espacio de cliente asociado a {email}. Si crees que es un error, contacta al freelancer que te invitó.',
  'portal.yourProjects': 'Tus Proyectos',
  'portal.noProjects': 'Aún no hay proyectos.',
  'portal.noTasks': 'Aún no hay tareas.',
  'portal.due': 'Vence {date}',
  'portal.failedToLoad': 'No se pudo cargar tu portal: {error}',
  'portal.retry': 'Reintentar',
  'portal.greeting': 'Bienvenido, {name}',
```

- [ ] **Step 3: Verify + commit**

```bash
npm run lint && npm run build
git add src/lib/i18n.tsx
git commit -m "feat(i18n): portal strings (en, es)"
```

---

### Task 4: usePortalData hook

**Files:**
- Create: `freelance-tracker/src/hooks/usePortalData.ts`

No unit test (it's a thin Supabase fetch wrapper, same as every other hook in this codebase); covered by live verification.

- [ ] **Step 1: Implement**

```ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PortalClient, PortalProject, PortalTask } from '../lib/portal'

/**
 * Reads the three portal_* views. The database scopes every row to the
 * logged-in JWT email, so this hook does no filtering of its own.
 */
export function usePortalData() {
  const [clients, setClients] = useState<PortalClient[]>([])
  const [projects, setProjects] = useState<PortalProject[]>([])
  const [tasks, setTasks] = useState<PortalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, p, t] = await Promise.all([
        supabase.from('portal_clients').select('*'),
        supabase.from('portal_projects').select('*'),
        supabase.from('portal_tasks').select('*'),
      ])
      const firstError = c.error ?? p.error ?? t.error
      if (firstError) throw firstError
      setClients((c.data ?? []) as PortalClient[])
      setProjects((p.data ?? []) as PortalProject[])
      setTasks((t.data ?? []) as PortalTask[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portal data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    clients,
    projects,
    tasks,
    loading,
    error,
    refetch: fetchAll,
    /** True once loaded if the signed-in email matches at least one client record. */
    isPortalUser: clients.length > 0,
  }
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run lint && npm run build
git add src/hooks/usePortalData.ts
git commit -m "feat(portal): usePortalData hook over portal views"
```

---

### Task 5: PortalLayout + PortalLogin

**Files:**
- Create: `freelance-tracker/src/components/PortalLayout.tsx`
- Create: `freelance-tracker/src/pages/PortalLogin.tsx`

- [ ] **Step 1: PortalLayout** — `src/components/PortalLayout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../lib/i18n'

interface Props {
  clientName?: string
  children: ReactNode
}

/** Minimal chrome for the client portal: logo, client name, language, sign out. */
export default function PortalLayout({ clientName, children }: Props) {
  const { t, lang, setLang } = useI18n()
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/bough-logo.png" alt="Bough" className="w-8 h-8 object-contain" />
            <div>
              <p className="text-text-primary text-[14px] font-bold leading-tight">Bough</p>
              <p className="text-text-muted text-[10px] uppercase tracking-[1.5px]">{t('portal.title')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {clientName && (
              <span className="hidden sm:inline text-text-secondary text-[12px] font-semibold">{clientName}</span>
            )}
            <button
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="px-2 py-1 rounded-[8px] bg-input-bg text-text-muted text-[11px] font-semibold hover:text-text-primary transition-colors"
            >
              {lang === 'en' ? 'ES' : 'EN'}
            </button>
            {user && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-text-muted text-[11px] font-semibold hover:text-text-primary hover:bg-input-bg transition-colors"
              >
                <LogOut size={12} />
                {t('portal.signOut')}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: PortalLogin** — `src/pages/PortalLogin.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import PortalLayout from '../components/PortalLayout'

const RESEND_COOLDOWN_S = 60

export default function PortalLogin() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function sendLink() {
    setSending(true)
    setError(null)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      })
      if (otpError) throw otpError
      setSent(true)
      setCooldown(RESEND_COOLDOWN_S)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-sm mx-auto mt-[8vh] bg-surface rounded-[14px] shadow-card p-6">
        {sent ? (
          <div className="text-center">
            <MailCheck size={28} className="mx-auto text-accent mb-3" />
            <p className="text-text-primary text-[14px] font-semibold mb-1">{t('portal.linkSent')}</p>
            <p className="text-text-muted text-[12px] mb-4">{email}</p>
            <button
              onClick={sendLink}
              disabled={cooldown > 0 || sending}
              className="text-accent text-[12px] font-semibold hover:underline disabled:text-text-muted disabled:no-underline"
            >
              {cooldown > 0 ? t('portal.resendIn', { s: cooldown }) : t('portal.resend')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (email) sendLink()
            }}
          >
            <h1 className="text-text-primary text-[16px] font-bold mb-1">{t('portal.title')}</h1>
            <p className="text-text-muted text-[12px] mb-4">{t('portal.signInPrompt')}</p>
            <label htmlFor="portal-email" className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {t('portal.emailLabel')}
            </label>
            <input
              id="portal-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 mb-4 w-full h-10 px-3 rounded-[10px] bg-input-bg border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={sending || !email}
              className="w-full h-10 rounded-[10px] bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              {sending ? t('portal.sending') : t('portal.sendLink')}
            </button>
            {error && <p className="mt-3 text-negative text-[12px]">{t('portal.sendFailed', { error })}</p>}
          </form>
        )}
      </div>
    </PortalLayout>
  )
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run lint && npm run build
git add src/components/PortalLayout.tsx src/pages/PortalLogin.tsx
git commit -m "feat(portal): portal layout and magic-link login page"
```

---

### Task 6: Portal dashboard page

**Files:**
- Create: `freelance-tracker/src/pages/Portal.tsx`

- [ ] **Step 1: Implement** — `src/pages/Portal.tsx`:

```tsx
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePortalData } from '../hooks/usePortalData'
import { groupTasksByStatus, orderProjects, type PortalTask } from '../lib/portal'
import PortalLayout from '../components/PortalLayout'
import { useI18n } from '../lib/i18n'

const PRIORITY_TONE: Record<PortalTask['priority'], string> = {
  high: 'bg-negative-bg text-negative',
  medium: 'bg-status-active-bg text-status-active-text',
  low: 'bg-input-bg text-text-muted',
}

const PROJECT_STATUS_KEY: Record<string, string> = {
  active: 'status.active',
  completed: 'status.completed',
  on_hold: 'status.onHold',
  cancelled: 'status.cancelled',
}

export default function Portal() {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const { clients, projects, tasks, loading, error, refetch } = usePortalData()

  const ordered = useMemo(() => orderProjects(projects), [projects])
  const tasksByProject = useMemo(() => {
    const map = new Map<string, PortalTask[]>()
    for (const task of tasks) {
      const list = map.get(task.project_id) ?? []
      list.push(task)
      map.set(task.project_id, list)
    }
    return map
  }, [tasks])

  function formatDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-accent" />
        </div>
      </PortalLayout>
    )
  }

  if (error) {
    return (
      <PortalLayout>
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          {t('portal.failedToLoad', { error })}
          <button onClick={refetch} className="ml-3 underline font-semibold">
            {t('portal.retry')}
          </button>
        </div>
      </PortalLayout>
    )
  }

  if (clients.length === 0) {
    return (
      <PortalLayout>
        <div className="max-w-sm mx-auto mt-[8vh] bg-surface rounded-[14px] shadow-card p-6 text-center">
          <h1 className="text-text-primary text-[15px] font-bold mb-2">{t('portal.noAccessTitle')}</h1>
          <p className="text-text-muted text-[12px]">
            {t('portal.noAccessBody', { email: user?.email ?? '' })}
          </p>
        </div>
      </PortalLayout>
    )
  }

  const clientName = clients[0].company ?? clients[0].name

  const TASK_GROUPS: { key: keyof ReturnType<typeof groupTasksByStatus>; label: string }[] = [
    { key: 'todo', label: t('status.todo') },
    { key: 'in_progress', label: t('status.inProgress') },
    { key: 'done', label: t('status.done') },
  ]

  return (
    <PortalLayout clientName={clientName}>
      <h1 className="text-text-primary text-[18px] font-bold mb-1">
        {t('portal.greeting', { name: clients[0].name })}
      </h1>
      <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px] mb-5">
        {t('portal.yourProjects')}
      </p>

      {ordered.length === 0 && (
        <div className="bg-surface rounded-[14px] shadow-card p-8 text-center text-text-muted text-[13px]">
          {t('portal.noProjects')}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {ordered.map((project) => {
          const grouped = groupTasksByStatus(tasksByProject.get(project.id) ?? [])
          const total = (tasksByProject.get(project.id) ?? []).length
          const muted = project.status !== 'active'
          return (
            <section
              key={project.id}
              className={`bg-surface rounded-[14px] shadow-card p-5 ${muted ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h2 className="text-text-primary text-[15px] font-bold">{project.name}</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-active-bg text-status-active-text">
                  {t(PROJECT_STATUS_KEY[project.status] ?? 'status.active')}
                </span>
              </div>
              {project.description && (
                <p className="text-text-muted text-[12px] mb-3">{project.description}</p>
              )}
              {total === 0 ? (
                <p className="text-text-muted text-[12px] py-2">{t('portal.noTasks')}</p>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {TASK_GROUPS.map(({ key, label }) =>
                    grouped[key].length === 0 ? null : (
                      <div key={key}>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                          {label} · {grouped[key].length}
                        </h3>
                        <ul className="flex flex-col gap-1.5">
                          {grouped[key].map((task) => (
                            <li
                              key={task.id}
                              className="flex items-center justify-between gap-3 bg-input-bg/50 rounded-[10px] px-3 py-2"
                            >
                              <span className={`text-[12px] ${key === 'done' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                                {task.title}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                {task.due_date && key !== 'done' && (
                                  <span className="text-text-muted text-[10px]">
                                    {t('portal.due', { date: formatDate(task.due_date) })}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase ${PRIORITY_TONE[task.priority]}`}>
                                  {task.priority}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </PortalLayout>
  )
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run lint && npm run build && npm test
git add src/pages/Portal.tsx
git commit -m "feat(portal): read-only client dashboard"
```

---

### Task 7: Routing + portal-only redirect

**Files:**
- Modify: `freelance-tracker/src/App.tsx`
- Create: `freelance-tracker/src/components/OwnerGate.tsx`

- [ ] **Step 1: OwnerGate** — `src/components/OwnerGate.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * Keeps portal-only users out of the freelancer app. A signed-in user who owns
 * no clients rows (base table is owner-scoped by RLS) but matches portal_clients
 * is a client — send them to /portal. Everyone else (owners, brand-new
 * freelancer accounts) passes through.
 */
export default function OwnerGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'owner' | 'portal'>('checking')

  useEffect(() => {
    let cancelled = false
    async function check() {
      const [owned, portal] = await Promise.all([
        supabase.from('clients').select('id', { head: true, count: 'exact' }).limit(1),
        supabase.from('portal_clients').select('id', { head: true, count: 'exact' }).limit(1),
      ])
      if (cancelled) return
      const ownsRows = (owned.count ?? 0) > 0
      const isPortal = (portal.count ?? 0) > 0
      setState(!ownsRows && isPortal ? 'portal' : 'owner')
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }
  if (state === 'portal') return <Navigate to="/portal" replace />
  return <>{children}</>
}
```

- [ ] **Step 2: App.tsx changes**

1. Add lazy imports next to the others:

```ts
const Portal = lazy(() => import('./pages/Portal'))
const PortalLogin = lazy(() => import('./pages/PortalLogin'))
```

2. Import OwnerGate: `import OwnerGate from './components/OwnerGate'`

3. Add the portal route in the public section (above the `user ?` branch) — it serves both states:

```tsx
<Route path="/portal" element={user ? <Portal /> : <PortalLogin />} />
```

4. Wrap the authenticated Layout route with the gate — change `<Route element={<Layout />}>` to:

```tsx
<Route element={<OwnerGate><Layout /></OwnerGate>}>
```

- [ ] **Step 3: Verify + commit**

```bash
npm run lint && npm run build && npm test
git add src/App.tsx src/components/OwnerGate.tsx
git commit -m "feat(portal): /portal route and portal-only redirect gate"
```

---

### Task 8: Verification + ship (controller-led)

The controller (main session) performs this task directly — it needs MCP access
(Supabase, browser) and push approval already granted by the user.

- [ ] **Step 1: Apply the migration** via Supabase MCP `apply_migration`
      (project `pnilvktjzpnyqhnowuhs`, name `client_portal_views`), then SQL spot-checks
      via `execute_sql` (read-only):
      `select viewname from pg_views where viewname like 'portal_%'` → 3 rows;
      `select grantee, privilege_type from information_schema.role_table_grants where table_name like 'portal_%'` → SELECT for authenticated only.

- [ ] **Step 2: Test fixtures via the app UI** (allowed path — no direct DB writes):
      as the existing test owner (claude.uiverify.bough@gmail.com), add 3–4 tasks to
      "Site Redesign" / "Brand Refresh" via the Work page (varied status/priority/due dates),
      and set the Acme Verify Co client's email to a second test address.
      Create the second test auth user by signup, confirm via
      `/auth/v1/verify?token=<confirmation_token from auth.users>&type=signup`
      (same procedure used for the quick-log verification account).

- [ ] **Step 3: Live verification with screenshots** (dev server, Chrome MCP):
      portal login form; link-sent state; dashboard as the portal client (projects +
      grouped tasks); no-access state for a non-client login; Spanish toggle; portal-only
      redirect (visiting `/` as the client lands on `/portal`).

- [ ] **Step 4: Isolation checks (all must pass):**
      1. Portal client sees ONLY Acme data (Reggie's real clients absent).
      2. As the portal client, direct REST selects on `clients`, `projects`, `tasks` → zero rows.
      3. Signed-out (anon) REST select on `portal_tasks` → permission denied.
      4. View responses contain none of: notes, phone, hourly_rate, monthly_rate, billing_type, user_id.
      5. Owner login unaffected (dashboard, clients, time tracker all normal).

- [ ] **Step 5: Gate + ship:** `npm run lint && npm run build && npm test`; merge
      `feature/client-portal` into `main` (--no-ff, matching repo style); push; watch CI;
      hard-reload prod `/portal` and screenshot.

- [ ] **Step 6: Report** — include the one manual follow-up for Reggie: add
      `https://<prod-domain>/portal` and `http://localhost:5173/portal` to the Supabase
      Auth redirect allowlist (Dashboard → Auth → URL Configuration) so magic-link
      emails land on the portal, and plan custom SMTP before inviting many clients.

---

## Out of scope (do not build)

- Comments/approvals or any client write path.
- Invoices, time entries, contracts in the portal.
- Custom SMTP configuration.
- Invitation emails from the app.
