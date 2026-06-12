-- FreelanceTracker: client portal read-only views
-- Spec: docs/superpowers/specs/2026-06-12-client-portal-design.md
--
-- Three definer views scope rows to the logged-in JWT email and expose ONLY
-- safe columns. Base-table RLS policies are untouched: portal users still get
-- zero rows from clients/projects/tasks directly. anon gets nothing at all.
-- Deliberately excluded: clients.notes/phone/hourly_rate, projects.hourly_rate/
-- monthly_rate/billing_type, tasks.assignee, every user_id.
--
-- NOTE: Supabase's security linter flags these views as security_definer_view.
-- That is the intentional design — do NOT flip them to security_invoker = true;
-- base-table RLS would then return zero rows and break the portal.
--
-- Auth preconditions (verify in Dashboard -> Auth before relying on these views):
--   1. Email confirmation ON (otherwise a password signup with a client's email
--      grants their portal without inbox access).
--   2. Anonymous sign-ins OFF (no-email authenticated JWTs).

BEGIN;

CREATE OR REPLACE VIEW public.portal_clients
WITH (security_invoker = false, security_barrier = true) AS
SELECT c.id, c.name, c.company
FROM public.clients c
WHERE c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND lower(c.email) = lower(auth.jwt()->>'email');

CREATE OR REPLACE VIEW public.portal_projects
WITH (security_invoker = false, security_barrier = true) AS
SELECT p.id, p.client_id, p.name, p.description, p.status, p.start_date, p.end_date
FROM public.projects p
JOIN public.clients c ON c.id = p.client_id
WHERE c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND lower(c.email) = lower(auth.jwt()->>'email');

CREATE OR REPLACE VIEW public.portal_tasks
WITH (security_invoker = false, security_barrier = true) AS
SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
       t.start_date, t.due_date, t.updated_at
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
JOIN public.clients c ON c.id = p.client_id
WHERE c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND lower(c.email) = lower(auth.jwt()->>'email');

-- Guard the invariant the views depend on: client emails are never blank strings.
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_email_not_blank;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_email_not_blank CHECK (email IS NULL OR btrim(email) <> '');

-- Cheap insurance: the email predicate runs on every portal request.
CREATE INDEX IF NOT EXISTS idx_clients_email_lower ON public.clients (lower(email));

-- Definer semantics: run as the view owner (postgres), which bypasses base-table
-- RLS, so the WHERE clauses above are the entire access control. Lock the grants:
REVOKE ALL ON public.portal_clients,  public.portal_projects,  public.portal_tasks
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portal_clients, public.portal_projects, public.portal_tasks
  TO authenticated;

COMMIT;
