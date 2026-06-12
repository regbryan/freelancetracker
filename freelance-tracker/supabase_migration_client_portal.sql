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
