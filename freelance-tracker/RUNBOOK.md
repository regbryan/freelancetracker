# Runbook

Operational guide for FreelanceFlow. When something breaks or needs to ship, start here.

## Deploy

Production deploys happen on push to `main`. Vercel builds, runs `tsc -b && vite build`, and promotes.

**Preview deploys** fire on every PR — open the PR's "Visit Preview" link to test before merging.

### Pre-flight before merging to main

- [ ] CI green (typecheck, lint, build, osv-scan, gitleaks)
- [ ] No new env vars required (or added to Vercel Project Settings → Environment Variables)
- [ ] DB migrations applied to staging Supabase and verified
- [ ] CHANGELOG updated (if not yet present — add it before next release)

## Rollback

### Code rollback (Vercel)

1. Open [Vercel dashboard](https://vercel.com) → Project → **Deployments**
2. Find the last known-good production deployment
3. **⋯** menu → **Promote to Production**
4. Verify at production URL within 60s (Vercel CDN propagates fast)
5. Post in `#incidents` (or wherever) with the deployment SHA you rolled back to

### Database migration rollback

**There is no automated migration rollback.** SQL files in `freelance-tracker/supabase_migration_*.sql` are applied manually via the Supabase SQL editor or `supabase db push`.

Before applying a migration to production:
1. Apply to staging Supabase first
2. Test the affected flow
3. Write the reverse SQL (drop the new column, restore the old policy, etc.) and save it in your notes
4. Only then apply to production

If a migration breaks production:
- Most schema changes (added columns, added policies) are **non-destructive** — code rollback may be enough; the new column just sits unused.
- Destructive changes (DROP COLUMN, NOT NULL added without backfill) require the reverse SQL you saved.
- Worst case: restore from Supabase point-in-time recovery (PITR) — Settings → Database → Backups.

### Drilling rollback

Once per quarter, dry-run a rollback in staging:
1. Note the current production deployment SHA
2. Deploy an obviously broken change to staging
3. Promote a previous staging deployment
4. Time how long the recovery takes; update this section if the procedure has changed

## When the app is broken in production

### First 5 minutes

1. **Check Vercel Deployments** — did a deploy just go out? If yes, jump to "Code rollback" above.
2. **Check Supabase status** — `pnilvktjzpnyqhnowuhs.supabase.co` — and the [Supabase status page](https://status.supabase.com)
3. **Check Sentry** — `<TODO: Sentry org/project URL>` — recent error spike?
4. **Reproduce on `vercel preview`** — does the latest preview have it too? If yes, code regression. If no, likely env / data / external service.

### Common failure modes

| Symptom | Likely cause | First check |
|---|---|---|
| Users see a blank screen at login | Supabase URL/key env var missing or wrong | `vercel env ls` (production); compare to expected `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| "Method not allowed" on Gmail integration | Edge Function deploy failed or `--no-verify-jwt` flag missing | `supabase functions list`; redeploy with `supabase functions deploy gmail --no-verify-jwt` |
| Users see other users' data (worst case) | RLS policy regression | Check `supabase_migration_rls_security.sql` policies are still applied; review recent migrations |
| Sign-by-token returns 404 for valid link | `status` not advanced to `sent`, or `sign_token` mismatch | Check the contracts table; the public RLS policy only exposes `sent` and `signed` contracts |
| Invoice PDF generation crashes | dompurify / jspdf version mismatch | Check `package-lock.json` did not regress; run `npm audit` |
| Calendar events fail to load | `VITE_CALENDAR_API_URL` env not set, or downstream service down | Check the env in Vercel; check downstream calendar service |

## External dependencies (sub-processors)

| Service | Used for | Where to check status |
|---|---|---|
| **Supabase** | Auth, DB, storage, Edge Functions | https://status.supabase.com |
| **Vercel** | Hosting, preview deploys | https://www.vercel-status.com |
| **Google APIs** | Gmail OAuth + Gmail API + Calendar | https://status.cloud.google.com |
| **Microsoft Graph** | Outlook Calendar OAuth | https://admin.microsoft.com/servicehealth |
| **Stripe** | Payment links | https://status.stripe.com |
| **Unified-calendar (LLM proxy)** | AI email search (`/api/parse-receipt`) | external Vercel deployment — author-owned |

## Cost monitoring

- **Vercel** — Dashboard → Usage. Alert configured at $XX/mo (TODO: configure).
- **Supabase** — Project → Billing. Egress + DB compute + Edge invocations.
- **Google APIs** — Cloud Console → Billing. Gmail API has a generous free quota; OAuth doesn't bill.
- **LLM proxy** — runs on `unified-calendar-eight.vercel.app`; cost lands wherever the OpenAI/Anthropic key for that proxy is set. **Currently unauthenticated and abuse-prone — see review notebook B4.5-1.**

## Useful one-liners

```bash
# Apply a migration to production (after testing on staging)
supabase db push

# Deploy the Gmail Edge Function
supabase functions deploy gmail --no-verify-jwt

# Check what env vars are set on Vercel production
vercel env ls production

# Pull production env to .env.local for local debugging
vercel env pull .env.local

# Roll back the last production deploy via CLI
vercel rollback <deployment-url>

# Run the local pre-ship checks the CI runs in cloud
cd freelance-tracker && npm ci --legacy-peer-deps && npx tsc --noEmit && npm run lint && npm run build
```

## Open items in this runbook

- [ ] Add Sentry URL once project is provisioned
- [ ] Wire spend alerts on Vercel + Supabase
- [ ] Document each new feature here on ship (where to look when it breaks, who owns it)
- [ ] Move migrations under `supabase/migrations/` with timestamped names
- [ ] Write per-migration `down.sql` files
