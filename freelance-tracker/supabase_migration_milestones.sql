-- FreelanceTracker: milestones layer
-- Spec: docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md
--       (Revision 2026-09-02 (b) — Milestones layer)
--
-- Adds Projects -> Milestones -> Tasks. A milestone is a named phase of one
-- project with optional dates; tasks point at one via tasks.milestone_id
-- (ON DELETE SET NULL, so deleting a phase never deletes the work).
--
-- RLS mirrors the tasks policies from supabase_migration_project_members.sql:
-- the owner of the parent project has full access, and so does anyone the
-- owner invited to that project (is_project_member is SECURITY DEFINER; the
-- linter's warning about it is intentional and documented in that file).
--
-- The portal gets a new definer view, portal_milestones, scoped by the
-- logged-in JWT email exactly like portal_clients/projects/tasks, and
-- portal_tasks gains milestone_id as its last column.
--
-- Until this runs, useMilestones and usePortalData get PGRST205 (relation not
-- found) and treat it as "no milestones"; the app keeps working.
--
-- No BEGIN/COMMIT: the migration tool wraps this in its own transaction.

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  start_date  DATE,
  end_date    DATE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Either date may be missing (the Gantt then derives the span from the
  -- milestone's tasks); when both exist they must be in order.
  CONSTRAINT milestones_dates_ordered
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- The repo has no updated_at trigger function (checked: no other migration
-- defines one), so the app keeps updated_at current -- useMilestones sends
-- updated_at with every update, same as it would for any other column.

-- 2. Task link ---------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON public.tasks (milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_sort ON public.milestones (project_id, sort_order);

-- 3. RLS ---------------------------------------------------------------------
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Deliberately NO `auth.uid() = user_id` clause, for the same reason the tasks
-- policies dropped theirs (see the design doc's Security verification section
-- and supabase_migration_project_members.sql step 5): with such a clause any
-- signed-in user who learns a project id -- a portal client reading
-- portal_projects, for instance -- could insert a row into someone else's
-- project and have the owner see it. Access is purely "do you own / are you a
-- member of the parent project".
DROP POLICY IF EXISTS owner_manages_milestones ON public.milestones;
CREATE POLICY owner_manages_milestones ON public.milestones
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS members_manage_milestones ON public.milestones;
CREATE POLICY members_manage_milestones ON public.milestones
  FOR ALL
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- 4. Portal views ------------------------------------------------------------
-- Definer semantics, like the other portal_* views: they run as the view owner
-- and bypass base-table RLS, so the email predicate below is the entire access
-- control. Do NOT flip these to security_invoker = true.
CREATE OR REPLACE VIEW public.portal_milestones
WITH (security_invoker = false, security_barrier = true) AS
SELECT m.id, m.project_id, m.name, m.start_date, m.end_date, m.sort_order
FROM public.milestones m
JOIN public.projects p ON p.id = m.project_id
JOIN public.clients c ON c.id = p.client_id
WHERE c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND lower(c.email) = lower(auth.jwt()->>'email');

-- Same definition as in supabase_migration_client_portal.sql with milestone_id
-- appended -- CREATE OR REPLACE VIEW can add columns at the end but cannot
-- reorder or retype the existing ones, so the new column must stay last.
CREATE OR REPLACE VIEW public.portal_tasks
WITH (security_invoker = false, security_barrier = true) AS
SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
       t.start_date, t.due_date, t.updated_at, t.milestone_id
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
JOIN public.clients c ON c.id = p.client_id
WHERE c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND lower(c.email) = lower(auth.jwt()->>'email');

REVOKE ALL ON public.portal_milestones, public.portal_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portal_milestones, public.portal_tasks TO authenticated;

-- 5. Grants ------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
