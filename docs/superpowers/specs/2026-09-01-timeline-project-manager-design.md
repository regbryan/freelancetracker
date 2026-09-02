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
  **Timeline · Tasks · Timer**. The tab labels are translated, via the `nav.timeline`,
  `nav.tasks`, and `nav.timer` keys. Nothing else in the sidebar changes.
- `/timeline` shows **one project at a time** (revised 2026-09-02 — see below). A
  switcher row sits above the grid: an **Overview** chip, then a chip per recently
  updated active project, then a compact select listing every project for anything the
  chips leave out. The chips use the same segmented pill styling as the zoom control.
  Selection lives in the URL as `?project=<id>` or `?project=all`, so the view is
  shareable, and is mirrored into `localStorage['timeline.lastProject']` so a bare
  `/timeline` reopens where the user left off.
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
  today?: string                    // fixes "today" for deterministic tests
  labelWidth?: number               // label column width; default 220, portal passes 150
}
```

### Layout

- Fixed pixel scale per zoom: week = 40 px/day, month = 12 px/day, quarter = 4 px/day.
  Total width = `totalDays × pxPerDay`. The grid scrolls horizontally inside the card;
  the label column is sticky-left and its width is the `labelWidth` prop (220 by
  default, 150 in the portal).
- Visible range = min(earliest date, today − 30d) − 7d to max(latest date, today + 90d)
  + 14d, same as today, then clamped to about four years around today
  (`MAX_SPAN_DAYS = 1461`) so one stray date cannot blow the track width up.
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
  `localStorage` under `timeline.zoom`; **default Week** (revised 2026-09-02).
- **One project at a time** (revised 2026-09-02). The selected project's row and its
  tasks are all that render; `canEditProjects` and task editing are unchanged.
- **Overview** (`?project=all`) is the only multi-project view: `TimelineGantt` gets
  every project and `tasks={[]}`, so it draws one bar per project and no task rows.
  Project bars stay draggable for owners. A muted line above the grid
  (`timeline.overviewHint`) says what the mode is for, and `TimelineInsight` — which
  reasons about every project — renders only here.
- Selection rules live in `src/lib/timelineSelection.ts` (`resolveSelection`,
  `quickPickProjects`, `OVERVIEW`), pure and unit-tested. `resolveSelection` takes, in
  order: a valid `?project=` value, then a valid remembered value, then the most
  recently updated **active** project, then the most recently updated project of any
  status, then Overview when the workspace is empty. Both stored and URL values are
  re-validated against the loaded projects, so a link to a deleted project still lands
  somewhere useful. Whatever is resolved is written back to the URL with
  `replace: true`. `quickPickProjects` returns up to six recently updated active
  projects for the chips and always includes the current selection, even when it is
  paused, finished, or outside the cap.
- Freshness with two editors: refetch tasks on `window` `focus` and on a 60 s interval
  while the page is mounted. Last write wins; no conflict UI.

### Revision 2026-09-02 — one project at a time

Decided after Reggie's visual review of `/timeline` with real data (18 projects, 122
mostly one-day tasks): every project stacked into one Gantt was an unreadable wall, and
Month zoom turned one-day tasks into slivers too small to grab. The page therefore shows
a single project by default, Overview replaces the old "All projects" filter value with
a deliberately task-free bird's-eye view, and the default zoom becomes Week. The
`TimelineGantt` component, its props, and the drag interaction are unchanged; only the
page's selection model and the controls above the grid changed.

A second review the same day, with the same data, rejected four more things and they were
fixed together:

- **The range follows the content, not the calendar.** `computeRange` always reserved
  today−30..today+90, so a project whose work ran in March opened on a screenful of empty
  track with every bar off to the left. `computeContentRange(dates, today)` spans
  min(earliest, today)−7 .. max(latest, today)+14 — same ISO validation, same
  `MAX_SPAN_DAYS` clamp toward today, falling back to `computeRange` when nothing is
  dated. `initialScrollDay(range, dates, today)` decides where the view opens: today when
  today lies inside the content, otherwise the earliest dated thing, never negative. The
  mount/zoom auto-scroll puts that day ~15% from the left of the track (it was today at
  25%); the `lastZoomRef` guard still keeps a refetch from yanking the viewport.
  `computeRange` stays for anything that genuinely wants a today-anchored window.
- **Labels are readable.** The default label column is 320 px (was 220, which clipped
  titles at ~25 characters); project and task labels wrap to two lines
  (`line-clamp-2` + `whitespace-normal` + `leading-snug`) and keep a `title` with the full
  text. Rows grow to fit — tracks are `min-h` rather than fixed `h-8`/`h-10`, with the row
  `flex items-stretch` so the track matches the row and the bar stays vertically centred.
  The read-only portal keeps its 150 px column and wraps too. Editable bars are *drawn* at
  a minimum 16 px (`Math.max(width, 16)` on the rendered width only — drag geometry still
  uses the true width) so a one-day task at Month or Quarter zoom can be grabbed.
- **Done tasks are hidden by default.** A "Hide done" pill sits with the zoom control,
  defaulting on and persisted in `localStorage['timeline.hideDone']` (only the literal
  `'false'` turns it off). Tasks with `status === 'done'` are dropped before they reach the
  Gantt, and a muted `{n} done hidden` count appears beside the toggle. Per-project mode
  only; Overview has no task rows to filter.
- **The timeline prints.** A "Print / PDF" button calls `window.print()`. The `@media
  print` block in `src/index.css` drops everything carrying `data-print-hide` (sidebar,
  top bar, bottom nav, hero, WorkTabs, insight banner, the controls row, the drag hint),
  reveals a print-only header rendered by `Timeline.tsx` with the project name (or
  "Overview"), the visible date range and the print date, makes the Gantt's scroll
  container `overflow: visible`, prints sticky label cells as `position: static`, keeps
  rows off page breaks with `break-inside: avoid`, and forces bar and weekend colours with
  `print-color-adjust: exact`. The sheet is `@page { size: landscape; margin: 12mm }` and
  the whole grid is scaled with `zoom: var(--print-scale)`, a variable `TimelineGantt`
  sets to `min(1, 1000 / (labelWidth + trackW))`.

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

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.project_members TO authenticated;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = p_project_id
      AND lower(m.email) = lower(auth.jwt()->>'email')
  );
$$;
REVOKE ALL ON FUNCTION public.is_project_member(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_member(UUID) FROM anon;
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
| `tasks` | replace `users_own_tasks`; add `members_manage_tasks` | Owner policy (ALL, USING and WITH CHECK): `EXISTS (project owned by auth.uid())` — purely project-based, so tasks a collaborator creates stay visible to the owner. The original `user_id = auth.uid() OR …` clause was removed because in WITH CHECK it let any signed-in user insert a task into a project they do not own by stamping their own `user_id` on it (see Security verification below). Member policy (ALL, USING and WITH CHECK): `is_project_member(project_id)`. |

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
- Owner-only, enforced twice: `OwnerGate` redirects a non-owner away from
  `/projects/:id` entirely, and the card itself mounts only when `role === 'owner'`.
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

- `Sidebar` shows two items for collaborators: **Timeline** and **Tasks**. The
  "New Project" quick-create button is hidden.
- `WorkTabs` hides Timer for collaborators.
- `TopBar`'s account menu hides the Settings item for collaborators (`/settings` is
  not a collaborator path, so it would only bounce back to `/timeline`). The language
  toggle and sign-out stay.
- `/tasks` works as-is: `useTasks()` returns only tasks the RLS lets through, and the
  project selector in `TaskForm` is fed by `useProjects()`, which returns only shared
  projects. Its project group headers show the project name as plain text for
  collaborators — no link into `/projects/:id`, which they cannot open.
- The command palette (`CommandPalette`) hides the Log-time action and all project
  results for collaborators, and routes task results to `/tasks` rather than to the
  task's project page. Results are additionally limited by the same RLS.
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
- Access lost mid-session (membership revoked while the page is open): the update
  matches zero rows under RLS, `useTasks.updateTask` throws `no-access`, and the
  Timeline banner shows `timeline.accessLost` ("You no longer have access to this
  project. Refresh to update your view.") instead of a raw Postgrest message.
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


## Revision 2026-09-02 (b) — Milestones layer

Decided after the owner's visual review, using Milestones PM+ (Passage Technology,
Salesforce-native) as the reference: Projects → Milestones → Tasks, a Gantt drawn at
milestone level with tasks nested and **collapsed by default**, and sharing by print/PDF
and the client portal. Owner's data already encodes phases as bracketed title prefixes
(52 of 122 tasks, 7 distinct prefixes in one project); those become milestones.

### Schema — `supabase_migration_milestones.sql`
- `public.milestones (id, project_id → projects cascade, user_id default auth.uid(),
  name not blank, start_date, end_date, sort_order int default 0, created_at, updated_at)`.
- `tasks.milestone_id uuid null → milestones(id) on delete set null`, indexed.
- RLS on `milestones`: `owner_manages_milestones` (ALL, project owned by auth.uid()) and
  `members_manage_milestones` (ALL, `is_project_member(project_id)`). No `user_id`
  clause (same lesson as tasks).
- Portal: new definer view `portal_milestones (id, project_id, name, start_date,
  end_date, sort_order)` scoped by client email like the other portal views;
  `portal_tasks` gains `milestone_id` (column appended).
- One-time data migration `supabase_migration_milestones_from_prefixes.sql`: for each
  (project, `^\[prefix\]`) group create a milestone named `prefix` with the group's
  min/max task dates, ordered by first date; point the tasks at it and strip the prefix
  from their titles.

### Gantt
- New prop `milestones?: GanttMilestone[]` (`id, project_id, name, start_date, end_date,
  sort_order`), `expandedMilestoneIds: Set<string>` + `onToggleMilestone(id)` (page owns
  the state, persisted per project in localStorage `timeline.expanded.<projectId>`),
  `onMilestoneDates?`, `onMilestoneClick?`.
- Per-project rows: project row → for each milestone (by `sort_order`, then start): a
  bold milestone row with a chevron, name, `done/total` count, and a bar spanning its own
  dates or, when it has none, the extent of its tasks; the bar carries a fill proportional
  to done tasks. Collapsed by default; expanded shows its tasks nested one level deeper.
  Tasks with no milestone go under an "Unassigned" group only when the project has at
  least one milestone; otherwise the flat layout is unchanged.
- Milestone bars drag/resize like project bars when `editable` (members may edit
  milestones: RLS allows it). Click opens the milestone dialog.
- Overview: project bar plus a small diamond at each milestone's end date.
- Hide-done hides tasks only; a fully-done milestone still shows its bar at 100%.
- **Mode and hide-done are props, not inferences** (settled while wiring the page).
  `mode?: 'project' | 'overview'`, default `'project'`: diamonds render only in
  `'overview'`, milestone rows only in `'project'`. It replaces the first cut's
  `tasks.length === 0 && milestones.length > 0` guess, which mistook a project whose tasks
  were all filtered away for a bird's-eye view. `hideDone?: boolean`, default false: the
  page passes **every** task of the project and the Gantt drops the `done` rows itself, so
  `done/total` and any span a milestone borrows from its tasks still count them — a
  milestone whose tasks are all done and hidden keeps its bar at 100% with `n/n`, and the
  track range includes each milestone's *drawn* span so that bar still fits on the track.
  Milestone bars are 18 px, the same as project bars; the first cut's 14 px sat under the
  16 px task bars and inverted the hierarchy the rows exist to show.

### Page and forms
- Timeline page: "+ Milestone" button when a project is selected (inline dialog: name,
  start, end). Milestone dialog also allows delete (tasks keep their dates, lose the link).
- **`MilestoneForm`** (`src/components/MilestoneForm.tsx`) is that dialog, built on the
  same `ui/dialog` vocabulary as `TaskForm`: name (required), native start and end date
  inputs, Save, and — in edit mode only — Delete behind a native `confirm` that says the
  tasks are kept and unassigned. Start after end is refused inline
  (`milestoneForm.dateOrder`) with Save disabled; equal dates are a one-day milestone, not
  an error. One date alone is allowed — the Gantt already falls back to the tasks' extent.
  Create, update and delete go through `useMilestones`; a failure surfaces in the page's
  existing error banner via the same `failMessage` mapping and the dialog stays open with
  the user's edits, exactly as `TaskForm` behaves. A new milestone takes
  `max(sort_order) + 1` so it lands after the ones already there. `onMilestoneClick` opens
  the same dialog in edit mode; `onMilestoneDates` (drag) writes through
  `updateMilestone` with the banner-and-rethrow pattern.
- Expansion state: a `Set` on the page seeded from
  `localStorage['timeline.expanded.<projectId>']` (a JSON array of ids, anything else
  treated as noise) and rewritten on every toggle. It is re-seeded by adjusting state
  during render rather than in an effect, so a project's first painted frame is already
  its remembered shape, and switching project resets it.
- Header line: `· K milestones` (`timeline.milestoneCounts`) after the task counts in
  project mode, when K > 0.
- `TaskForm` gains an optional `milestones` prop that renders a milestone select (first
  option "No milestone", carried as a sentinel because Radix rejects an empty item value)
  and a `milestoneId?: string | null` in both `TaskFormData` and the `task` edit shape,
  pre-selected from the task. The field is omitted from the saved payload entirely when no
  list was passed, so a caller that knows nothing about milestones can never null out an
  existing link. The Timeline page passes the selected project's milestones (and only when
  it has some) and saves `milestone_id`; Tasks and ProjectDetail pages are unchanged.
- `useMilestones(projectId)`: list / create / update / remove.
- Portal: `usePortalData` also reads `portal_milestones`; the Gantt renders milestones
  read-only, collapse toggles still work. The List view also groups each project's tasks
  by milestone (heading with `done/total`, in `sortMilestones` order, plus an Unassigned
  heading when leftover tasks remain); a project with no milestones is unchanged.
- Print: prints what is displayed (collapsed or expanded).

### Visual direction
Quiet professional tool, per `PRODUCT.md`: the data is the interface, chrome only where
it does a job. The stock-photo hero and the "insight" card are gone from `/timeline`
(`TimelineHero` and `TimelineInsight` deleted); the page opens on a plain header row —
project switcher, name, date span and task counts — with Print / PDF as the only action.
Controls are flat and standard: a native `<select>` for the project, a bordered segmented
control for zoom, a plain checkbox for Hide done, no pill chips, no gradients, no tiny
uppercase tracked labels. The Gantt is a bordered box, not a shadowed cream card, and its
bars are solid 3px-radius blocks — tan for to-do, green for in progress, sage for done,
navy for the project — with the today line at full accent and a small "Today" flag in the
header. The legend is one line under the chart, unlabelled.


### Milestones migration applied and verified (2026-09-02)

`supabase_migration_milestones.sql` applied to prod with Reggie's approval. Verified by
the same SQL impersonation method (temporary member row for `collab.verify@example.com`
on Site Redesign, then removed; all temporary milestones removed; tasks back to 122 with
no `milestone_id` set):

| Check | Result |
|---|---|
| policies on `milestones` | `owner_manages_milestones:ALL`, `members_manage_milestones:ALL`; RLS enabled |
| `tasks.milestone_id`, `portal_milestones`, `portal_tasks.milestone_id` (last column) | present |
| collaborator INSERT milestone on SHARED / UNSHARED | ok / 42501 RLS violation |
| collaborator links 3 SHARED tasks to a milestone | 3 rows |
| collaborator UPDATE owner's milestone on UNSHARED | 0 rows |
| owner sees both milestones incl. the collaborator-created one | 2 / 1 |
| portal client: `portal_milestones` / direct `milestones` / `portal_tasks` with milestone | 2 / 0 / 3 |
| security advisor | only the expected `security_definer_view` notice for `portal_milestones` |

The prefix→milestone data migration (`supabase_migration_milestones_from_prefixes.sql`)
has NOT been run; it waits for Reggie's go-ahead after he has seen milestones working.
