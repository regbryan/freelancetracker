# Timeline Project Manager (drag-edit timeline + project collaborators) — Design

**Date:** 2026-09-01
**Status:** Approved by Reggie (chat session)
**Scope:** Make the existing Timeline page an interactive, drag-editable planner; let
one collaborator edit tasks on specific shared projects; show the same timeline
read-only in the client portal. Everything else in the app (clients, billing, time,
meetings, email, calendar) is untouched.

## Problem

Reggie and a colleague are starting marketing work for a new client, ProSeries. The
client wants to see a timeline of the work. The colleague needs to add and reschedule
tasks on that project. Today:

- The Timeline page is read-only, hides any task or project without dates, uses a
  fixed percentage axis (no zoom), and sits three levels deep (Work → Timeline tab).
- Every table is row-level-secured to a single owner (`user_id = auth.uid()`). There is
  no way for a second person to edit anything. The only second-person concept is the
  read-only client portal.

Decisions from discovery:
- Keep the whole existing app. Reggie still invoices from it.
- Timeline items: **tasks with dates, grouped by project.** No phases, no milestones.
- Editing: **drag bars** to move and resize; click a bar to open the existing task form.
- Colleague: **edits only shared projects' tasks.** No access to clients, billing, time,
  or the project's own fields.
- Build: **extend the existing hand-built timeline.** No Gantt dependency. SVAR React
  Gantt is GPLv3 as of 1.3.1 and pins React 18; gantt-task-react was last published
  in 2022; frappe-gantt is MIT but vanilla/imperative and would fight the Bough styling.
- Rate privacy: **accepted** that a collaborator can read the shared project row
  (including `hourly_rate`/`monthly_rate`) through the API. The UI does not show it.

## Navigation

- Sidebar "Work" item now links to `/timeline`. `WorkTabs` order becomes
  **Timeline · List · Timer**. Nothing else in the sidebar changes.
- `/timeline` gains a project filter (select, "All projects" default). It reads and
  writes `?project=<id>` so the URL is shareable.
- `ProjectDetail` gets one "Open timeline" button linking to `/timeline?project=<id>`.
  No other change to that page except the Collaborators card (below).

## `TimelineGantt` component

New file `src/components/TimelineGantt.tsx`. The bar-rendering code currently inline in
`src/pages/Timeline.tsx` moves here. `Timeline.tsx` keeps the hero, `WorkTabs`,
`TimelineInsight`, the project filter, the zoom control, and data loading.

### Props

```ts
interface TimelineGanttProps {
  projects: Array<Pick<Project, 'id' | 'name' | 'status' | 'start_date' | 'end_date'>>
  tasks: Array<Pick<Task, 'id' | 'project_id' | 'title' | 'status' | 'start_date' | 'due_date'>>
  zoom: 'week' | 'month' | 'quarter'
  editable: boolean                 // false in the portal
  canEditProjects?: boolean         // owner only; default false
  onTaskDates?: (id: string, dates: { start_date: string; due_date: string }) => Promise<void>
  onProjectDates?: (id: string, dates: { start_date: string; end_date: string }) => Promise<void>
  onTaskClick?: (id: string) => void
  onScheduleTask?: (id: string, dates: { start_date: string; due_date: string }) => Promise<void>
}
```

### Layout

- Fixed pixel scale per zoom: week = 40 px/day, month = 12 px/day, quarter = 4 px/day.
  Total width = `totalDays × pxPerDay`. The grid scrolls horizontally inside the card;
  the 220 px label column is sticky-left.
- Visible range = min(earliest date, today − 30d) − 7d to max(latest date, today + 90d)
  + 14d, same as today.
- On mount and on zoom change, scroll so today sits about 25% from the left edge.
- Axis header: month ticks at every zoom; week view also draws day numbers and shades
  Saturday/Sunday columns.
- Today line spans header and all rows (existing behaviour).
- Every project row is shown, dated or not (today the page hides undated projects). A
  project with no dates has no bar, just its task rows.
- Task rows: dated tasks render as bars. Undated tasks render in a per-project
  **"Not scheduled (n)"** tray row beneath the dated tasks; each is a chip. Clicking a chip
  (when `editable`) calls `onScheduleTask(id, { start_date: today, due_date: today + 6d })`
  and the chip becomes a bar the user can then drag.
- Colours, legend, and hover styles are unchanged from the current page.

### Drag interaction (only when `editable`)

- Pointer events on the bar (`pointerdown` → `setPointerCapture` → `pointermove` →
  `pointerup`). Mouse and touch both work.
- **Move:** pointerdown anywhere on the bar except the 8 px edge zones. Horizontal delta
  is converted to whole days (`Math.round(dx / pxPerDay)`) and applied to both dates.
  The bar follows the pointer, snapped to days.
- **Resize:** pointerdown inside the left or right 8 px edge zone (cursor `ew-resize`).
  Only that date changes. Clamp so `due_date >= start_date` (minimum one-day bar).
- A drag of fewer than 3 px total is a click and calls `onTaskClick` instead.
- **Escape** during a drag cancels it and restores the original position.
- On pointerup with a change: the component keeps the new position (optimistic) and
  awaits `onTaskDates`. If the promise rejects, the bar snaps back to the original dates
  and the page shows a toast with the error message.
- Project bars use the same mechanics via `onProjectDates` when `canEditProjects`.
- While dragging, a small label above the bar shows the live `MMM d – MMM d` range.
- Keyboard: bars are focusable buttons; Enter opens the task (`onTaskClick`). Keyboard
  date nudging is out of scope; the task form remains the accessible path for dates.

### Pure helpers — `src/lib/timelineMath.ts`

Everything testable without the DOM lives here:
`parseDate`, `addDays`, `diffDays`, `pxToDays(dx, pxPerDay)`, `shiftRange(range, days)`,
`resizeRange(range, edge, days)` (with clamp), `computeRange(projects, tasks, today)`,
`monthTicks(range)`, `dayTicks(range)`, `weekendSpans(range)`.

## Page behaviour (`/timeline`)

- Loads `useProjects()` and `useTasks()` as today. Passes `editable={true}`,
  `canEditProjects={role === 'owner'}`.
- `onTaskDates` → `updateTask(id, dates)`. `onProjectDates` → `updateProject(id, dates)`.
  `onScheduleTask` → `updateTask`. `onTaskClick` → opens the existing `TaskForm`
  dialog in edit mode; saving refetches tasks.
- Zoom control: three segmented buttons (Week / Month / Quarter), persisted in
  `localStorage` under `timeline.zoom`; default Month.
- Project filter: when set, only that project's row and tasks render.
- Freshness with two editors: refetch tasks on `window` `focus` and on a 60 s interval
  while the page is mounted. Last write wins; no conflict UI.

## Collaborators

### Schema — `supabase_migration_project_members.sql`

```sql
CREATE TABLE public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (btrim(email) <> ''),
  role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by  UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The app lower-cases and trims email before insert; the index enforces uniqueness.
CREATE UNIQUE INDEX idx_project_members_project_email
  ON public.project_members (project_id, lower(email));
CREATE INDEX idx_project_members_email_lower ON public.project_members (lower(email));

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = p_project_id
      AND lower(m.email) = lower(auth.jwt()->>'email')
  );
$$;
REVOKE ALL ON FUNCTION public.is_project_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID) TO authenticated;
```

Only the `editor` role exists in v1; the column is there so a read-only role can be
added later without changing the table shape.

### RLS changes (only these tables change)

| Table | Policy | Rule |
|---|---|---|
| `project_members` | owner manages | ALL: `EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.user_id = auth.uid())` |
| `project_members` | member sees own row | SELECT: `lower(email) = lower(auth.jwt()->>'email')` |
| `projects` | keep `users_own_projects`; add `members_read_projects` | SELECT: `is_project_member(id)`. Writes stay owner-only through the existing ALL policy. |
| `tasks` | replace `users_own_tasks`; add `members_manage_tasks` | Owner policy (ALL, USING and WITH CHECK): `user_id = auth.uid() OR EXISTS (project owned by auth.uid())`, so tasks a collaborator creates stay visible to the owner. Member policy (ALL, USING and WITH CHECK): `is_project_member(project_id)`. |

`clients`, `time_entries`, `invoices`, `invoice_items`, `expenses`, `communications`,
`meeting_notes`, `contracts`, gmail tokens: **no change.** The portal views are
definer views joined through `clients.email` and are unaffected.

Note: `useTasks.createTask` sets `user_id` to the caller. A collaborator's tasks carry
the collaborator's `user_id`; the owner still sees them because owner access is via the
project. `useProjects` selects `*, clients(id, name, email, company)`. For a
collaborator the embedded `clients` object returns `null` (RLS on `clients` is
unchanged), which the UI already tolerates (`project.clients?.name`).

### Owner UI — Collaborators card on `ProjectDetail`

- New `src/hooks/useProjectMembers(projectId)`: list / add(email) / remove(id).
- Card lists member emails with a remove button, plus an email input and "Add" button.
  Emails are trimmed and lower-cased before insert. Duplicate → inline error.
- Visible only when `role === 'owner'`.
- No invitation email is sent in v1. Reggie tells the colleague to sign up at the normal
  login page with that exact email.

### Workspace role — `src/hooks/useWorkspaceRole.ts`

Replaces the inline check in `OwnerGate`. On session load it runs three head-count
queries in parallel: `clients` (owned rows), `portal_clients`, `project_members`
(own rows). Result:

| owns clients | in project_members | in portal_clients | role |
|---|---|---|---|
| yes | any | any | `owner` |
| no | yes | any | `collaborator` |
| no | no | yes | `portal` |
| no | no | no | `owner` (brand-new freelancer account, as today) |

`OwnerGate` becomes a thin wrapper: `portal` → `/portal`; `collaborator` → only
`/timeline` and `/tasks` are allowed, anything else redirects to `/timeline`.

### Collaborator UI

- `Sidebar` shows two items for collaborators: **Timeline** and **List** (the Tasks
  page). The "New Project" quick-create button is hidden.
- `WorkTabs` hides Timer for collaborators.
- `/tasks` works as-is: `useTasks()` returns only tasks the RLS lets through, and the
  project selector in `TaskForm` is fed by `useProjects()`, which returns only shared
  projects. `TopBar` search / command palette results are limited by the same RLS.
- `TimelineInsight` (the "runway" banner) is hidden for collaborators; it reasons
  about the whole business.

## Client portal timeline

- `Portal.tsx` gets a segmented toggle **Timeline · List** above the project cards,
  default Timeline, persisted in `localStorage` under `portal.view`.
- Timeline view renders one `TimelineGantt` with `editable={false}`, `zoom="month"`,
  fed from `portal_projects` and `portal_tasks` (they already expose `start_date`,
  `due_date`, `end_date`, `status`). Portal has a fixed zoom; no zoom control.
- List view is the existing card layout, unchanged.
- No database change for the portal.

## Error handling

- Drag save failure: revert + toast (message from Supabase error).
- Collaborator opening a route they cannot use: redirect to `/timeline` (no error).
- Adding a member email that is already present: inline "already added".
- A member whose auth email differs in case from the invited email still matches
  (`lower()` on both sides).
- Loading states and empty states keep the current page patterns.

## i18n

Every new user-facing string gets `en` and `es` entries in `src/lib/i18n.tsx`:
zoom labels, "Not scheduled", "Open timeline", Collaborators card strings, portal
toggle labels, error toasts.

## Testing

- **Unit (vitest):** `timelineMath.ts` — range computation, `pxToDays` rounding,
  `shiftRange`, `resizeRange` clamping (due never before start; one-day minimum),
  weekend spans, tick generation across month boundaries and year rollover.
- **Component (testing-library):** `TimelineGantt` renders one bar per dated task and
  one chip per undated task; a simulated pointer drag of `pxPerDay × 3` calls
  `onTaskDates` with dates shifted by three days; a 2 px drag calls `onTaskClick`;
  `editable={false}` renders no handles and never calls the callbacks; Escape during
  drag restores position.
- **Security (manual checklist in the plan):** with a second Supabase test account as
  the collaborator — can read/insert/update/delete tasks on the shared project, cannot
  read tasks on an unshared project, cannot update the project row, gets zero rows from
  `clients`, `time_entries`, `invoices`, `expenses`; removing the member row revokes
  access on next fetch. Owner sees collaborator-created tasks.
- **Visual (per CLAUDE.md):** screenshots at 1440, 1920, and 375 of `/timeline` in all
  three zooms, mid-drag, the Not-scheduled tray, the Collaborators card, the
  collaborator's two-item sidebar, and the portal timeline. Written critique before
  calling it done.

## Deployment steps (documented, not code)

1. Run `supabase_migration_project_members.sql` against project `pnilvktjzpnyqhnowuhs`
   from the Supabase SQL editor (same procedure as the earlier migrations).
2. Re-run the security advisor; the new definer function is expected and intentional.
3. Create the colleague's account by having them sign up at the app login with the
   invited email; email confirmation must remain ON.

## Out of scope

Dependency arrows, milestones, phases, drag-and-drop from the tray onto a specific day,
keyboard date nudging, realtime subscriptions, invitation emails, a read-only member
role, per-column hiding of project rates from members, calendar sync, and any change to
billing, time tracking, meetings, or email features.


## Security verification (2026-09-02)

Migration applied to Supabase project `pnilvktjzpnyqhnowuhs` with Reggie's approval,
plus two follow-ups found during verification (both also in
`supabase_migration_project_members.sql`):

1. `REVOKE EXECUTE ON FUNCTION is_project_member FROM anon` (Supabase's default
   privileges had granted it; the advisor flagged it).
2. `users_own_tasks` is now purely project-based. The `auth.uid() = user_id`
   clause in its WITH CHECK let any signed-in user, including a portal client who
   knows a project id from `portal_projects`, insert a task into a project they do
   not own, and the project-based USING clause then showed it to the owner. Verified
   before the fix (injected row visible to owner), fixed, re-verified.

Method: SQL impersonation in the Supabase MCP (`set_config('request.jwt.claims', ...)`
then `SET LOCAL ROLE authenticated`) using the test owner `claude.uiverify.bough@gmail.com`
(projects Site Redesign = SHARED, Brand Refresh = UNSHARED), a member row for
`collab.verify@example.com` backed by the portal test account's auth id, and the portal
client `acme.portal.verify@gmail.com`. All temp rows and the member row were removed
afterwards (tasks back to 122, no owner/user mismatches).

| Check (as collaborator unless noted) | Result |
|---|---|
| tasks on SHARED / UNSHARED / total | 3 / 0 / 3 |
| projects / clients / time_entries / invoices / expenses / portal_clients | 1 / 0 / 0 / 0 / 0 / 0 |
| own project_members row visible (mixed-case JWT email) | 1 |
| UPDATE projects on SHARED | 0 rows |
| INSERT task on SHARED, then UPDATE dates, then DELETE (separate statements) | 1 / 1 / 1 |
| INSERT task on UNSHARED | 42501 row-level security violation (after fix; succeeded before) |
| owner sees collaborator-created task on SHARED | yes |
| owner INSERT/DELETE on own project; own counts unchanged | 1 / 1; 3 and 1 |
| portal client direct `tasks` / `projects` | 0 / 0 (portal views still 2 projects) |
| after member row removed: tasks / projects / member rows | 0 / 0 / 0 |

Security advisor after the changes: only the intentional
`authenticated_security_definer_function_executable` warning for `is_project_member`
is new; the remaining items pre-date this work (portal definer views, backup tables,
`gmail_tokens`, leaked-password protection).

Not yet done: browser walkthrough as owner, collaborator, and portal client
(needs a signed-in session), and screenshots per CLAUDE.md.
