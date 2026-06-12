# Client Portal — Design

**Date:** 2026-06-12
**Status:** Approved by Reggie (chat session)
**Scope:** Read-only, task-focused client portal inside the existing app, secured by
email magic-link auth + column-scoped portal views. No client interactions (comments,
approvals) in v1. No separate deploy.

## Problem

Clients have no way to see the status of their work. Reggie wants a portal where each
client can review all of their tasks. It must be impossible for a client to see another
client's data or Reggie's private data (notes, rates, other clients' projects).

Decisions from discovery:
- Content: **tasks only** (per project, with status/priority/dates). No invoices,
  time entries, or contracts in v1.
- Interaction: **read-only**.
- Access: **email magic link** (Supabase `signInWithOtp`) — no passwords, no signup form.

Security context: the existing `/sign/:token` pattern is NOT a model to copy — its RLS
policy exposes all sent contracts to any caller with the anon key; the URL token is the
only secret and the database never checks it. The portal uses real authenticated
identity checked by the database on every row.

## Access & identity

- New public route **`/portal`**:
  - No session → `PortalLogin`: Bough-branded email form. Submit calls
    `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/portal` } })`,
    then shows a "check your email" state with a resend button (60s cooldown).
  - Session present → portal-user check (below) → `Portal` dashboard, or a
    "no portal found for this email" state with a sign-out button.
- **Portal user** = authenticated session whose email case-insensitively matches at
  least one `clients.email`. The check is "does `portal_clients` return rows?".
- **Owner stays owner:** Reggie's session owns `clients` rows (`user_id = auth.uid()`),
  so he keeps the normal app. A signed-in portal user who navigates to any freelancer
  route is redirected to `/portal` (guard in `App.tsx`: user matches `portal_clients`
  AND owns zero `clients` rows → portal-only).
- An unknown email can complete a magic-link sign-in (Supabase creates the auth user)
  but matches no client row and sees only the empty state. This is harmless by design.

### Deployment configuration (documented steps, not code)

1. Supabase Auth → URL configuration: add `https://<prod-domain>/portal` and
   `http://localhost:5173/portal` to the redirect allowlist.
2. Supabase's built-in mailer is limited (~2 emails/hour) — acceptable for piloting
   with a few clients; configure custom SMTP before inviting many clients.
3. Client records must carry the email address the client will log in with
   (matching is case-insensitive).

## Data access — portal views (the security core)

One migration, `supabase_migration_client_portal.sql`. No changes to existing table
policies. Three **views** in `public`, owned by `postgres` (definer semantics, so the
scoping lives in each view's WHERE clause), `GRANT SELECT TO authenticated` only —
`REVOKE` from `anon`:

| View | Columns (explicit — nothing else) | Scope |
|---|---|---|
| `portal_clients` | id, name, company | `lower(email) = lower(auth.jwt()->>'email')` |
| `portal_projects` | id, client_id, name, description, status, start_date, end_date | `client_id IN (SELECT id FROM clients WHERE lower(email) = lower(auth.jwt()->>'email'))` |
| `portal_tasks` | id, project_id, title, description, status, priority, start_date, due_date, updated_at | `project_id IN (SELECT id FROM portal-scoped projects)` |

Deliberately excluded columns: `clients.notes`, `clients.phone`, `clients.hourly_rate`,
`projects.hourly_rate`, `projects.monthly_rate`, `projects.billing_type`, `tasks.assignee`,
all `user_id`s.

Why views instead of new RLS policies on the base tables: row policies expose whole
rows — private notes and rates would leak. Views give column-level control, keep the
base tables locked to the owner, and ship as one self-contained migration.

## Frontend

| Unit | Kind | Responsibility |
|---|---|---|
| `pages/PortalLogin.tsx` | new | Email form, sent-confirmation state, resend w/ cooldown. No data access. |
| `pages/Portal.tsx` | new | Read-only dashboard: client name header; one section per project (status chip, date range); tasks grouped To Do / In Progress / Done with priority + due-date badges; empty states. |
| `components/PortalLayout.tsx` | new | Minimal chrome: Bough logo, client name, language toggle, sign out. No sidebar, no command palette, no quick-log dialog. |
| `hooks/usePortalData.ts` | new | Fetches the three views; exposes `{ clients, projects, tasks, loading, error, isPortalUser }`. |
| `lib/portal.ts` | new | Pure helpers: group tasks by status, order projects (active first, then completed/on hold/cancelled), date formatting inputs. Unit-tested. |
| `App.tsx` | changed | Public `/portal` route; portal-only users redirected to `/portal` from app routes. |
| `lib/i18n.tsx` | changed | `portal.*` strings, en + es. |

Visual language: existing Bough tokens (`bg-surface`, `shadow-card`, status chip styles)
so the portal feels like the same brand.

## Edge cases

- Email matches no client → friendly empty state + sign out (not an error).
- One email on multiple client records → union of all their projects/tasks.
- Completed / on-hold / cancelled projects shown after active ones, visually muted.
- Projects with zero tasks → "No tasks yet" inside the project section.
- Magic-link resend cooldown (60s) to protect the mailer rate limit.
- Loading and fetch-error states follow the app's existing patterns (spinner card,
  inline error with retry).

## Verification

- Unit tests (Vitest) for `lib/portal.ts` grouping/ordering helpers.
- `npm run lint`, `npm run build`, `npm test`, CI green.
- Live verification with screenshots:
  1. `/portal` login form; "check your email" state.
  2. Portal dashboard for a test client (projects + grouped tasks).
  3. "No portal for this email" state for a non-client login.
  4. Spanish rendering.
- **Isolation checks (must all pass):**
  1. Portal user sees ONLY their client's projects/tasks (another client's data exists
     and must be absent).
  2. Portal user's direct queries on base tables (`clients`, `projects`, `tasks`)
     return zero rows.
  3. Anonymous (no session) selects on the three views are denied.
  4. Excluded columns are not present in view responses (notes, rates, user_id).
  5. Reggie's own login still sees the full app unchanged.

## Out of scope (v1)

- Comments, approvals, or any client write access.
- Invoices, time entries, contracts, files in the portal.
- Custom SMTP setup (documented as pre-rollout step, not built here).
- Client email invitation flow (Reggie shares the `/portal` link manually).
- Separate subdomain/deploy.
