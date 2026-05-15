# FreelanceFlow

A freelance business management app — clients, projects, time, expenses, contracts, invoices, meetings, and Gmail/Calendar integration in one place.

> "Grow what you build." Branded as **Bough**.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 8, React Router 7, Tailwind 4, Radix UI primitives
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **PDF**: jsPDF + jspdf-autotable (invoices, contracts)
- **Hosting**: Vercel (SPA + security headers configured in `vercel.json`)
- **PWA**: `vite-plugin-pwa` with offline precache

## Routes

| Path | Purpose |
|---|---|
| `/` | Dashboard — stats, charts, recent activity, meetings |
| `/clients`, `/clients/:id` | Client management |
| `/projects`, `/projects/:id` | Project management with tabbed sub-views |
| `/tasks`, `/timeline` | Task list + roadmap view |
| `/time` | Time tracker with live timer |
| `/expenses` | Expense tracking |
| `/contracts` | Contracts (PDF + sign-by-token) |
| `/invoices` | Invoices (PDF, Stripe payment links, status flow) |
| `/meetings`, `/meetings/:id` | Meeting notes with action items |
| `/emails` | Gmail email search + AI summary |
| `/calendar` | Google + Outlook calendar view |
| `/settings` | Profile, integrations, invoice defaults |
| `/sign/:token` | **Public** contract signing page (no auth) |

## Environment variables

Create `.env.local` (gitignored) in this directory:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_CALENDAR_API_URL=https://<your-calendar-service>/api
```

Edge Function secrets (set via `supabase secrets set`, not env vars in the browser):

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SUPABASE_SECRET_KEY=sb_secret_...   # preferred; falls back to legacy SUPABASE_SERVICE_ROLE_KEY
```

## Development

```bash
npm install
npm run dev          # vite dev server on http://localhost:5173
npm run build        # tsc -b && vite build → dist/
npm run preview      # serve the production build locally
npm run lint         # eslint .
```

## Database migrations

SQL files live in the repo root for the moment (not yet under `supabase/migrations/`):

- `supabase_migration_rls_security.sql` — RLS hardening (drops legacy "Allow all" policies, adds `WITH CHECK`)
- `supabase_migration_contracts_public_access.sql` — sign-by-token policy tightening
- `supabase_migration_meeting_notes.sql`
- `supabase_migration_gmail_tokens.sql`
- `supabase_migration_monthly_billing.sql`

Apply in order via the Supabase SQL editor or `supabase db push`.

## Edge Functions

`supabase/functions/gmail/` — server-side proxy for all Gmail API calls. Deploy with:

```bash
supabase functions deploy gmail --no-verify-jwt
```

`--no-verify-jwt` is required because the gateway rejects ES256-signed user JWTs; the function validates the user internally via `admin.auth.getUser(token)`.

## Deployment

Pushes to `main` deploy to production on Vercel. Preview deployments on every PR.

Required Vercel env vars (Project Settings → Environment Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CALENDAR_API_URL`

## Security posture

- **RLS** is enforced on every table; the `"Allow all"` policies that previously made every authenticated user able to read/write the entire DB have been dropped.
- **Vercel security headers** (HSTS, X-Frame-Options DENY, Permissions-Policy, Referrer-Policy) configured in `vercel.json`.
- **Service-role key** never touches the browser — only Edge Functions use it.

## Open work

See the pre-ship review notebook for the canonical list. Highlights:
- Privacy policy + Terms + signup consent
- Automated tests (Vitest + Playwright) + CI pipeline
- Observability (Sentry) + rollback runbook
- AI email search needs auth + consent + PII redaction
- Visual artifacts (`/dev/architecture`, `/dev/schema`, `/dev/app-map`)

## License

Proprietary. All rights reserved.
