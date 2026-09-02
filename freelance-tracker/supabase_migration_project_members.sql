-- FreelanceTracker: project collaborators
-- Spec: docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md
--
-- Lets the owner invite an email to edit tasks on ONE project. Access is
-- email-based (like the client portal) so invites can precede signup.
--
-- Touches RLS on exactly two tables: projects (members may SELECT) and tasks
-- (members may do everything on tasks of their projects; the owner's policy
-- becomes project-based so collaborator-created tasks stay visible to the owner).
-- Every other table keeps its owner-only policy. Portal views are unaffected.
--
-- Supabase's linter will flag is_project_member() as SECURITY DEFINER. That is
-- intentional: it must read project_members without that table's RLS.
--
-- Until this runs, the app's useWorkspaceRole hook gets PGRST205 (table not
-- found) for project_members and treats it as "no rows"; that is expected.

BEGIN;

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (btrim(email) <> ''),
  role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor')),
  invited_by  UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The app lower-cases and trims email before insert; the index is the guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_project_email
  ON public.project_members (project_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_project_members_email_lower
  ON public.project_members (lower(email));

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 2. Membership check (definer: bypasses project_members RLS) ---------------
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = p_project_id
      AND lower(m.email) = lower(auth.jwt()->>'email')
  );
$$;
REVOKE ALL ON FUNCTION public.is_project_member(UUID) FROM PUBLIC;
-- Supabase's default privileges also grant EXECUTE to anon; take that back so
-- the RPC endpoint is not callable without a session. authenticated keeps it
-- (policies evaluate the function as the calling role); the advisor WARN for
-- that is intentional.
REVOKE EXECUTE ON FUNCTION public.is_project_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID) TO authenticated;

-- 3. project_members policies -----------------------------------------------
DROP POLICY IF EXISTS owner_manages_members ON public.project_members;
CREATE POLICY owner_manages_members ON public.project_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS member_sees_own_row ON public.project_members;
CREATE POLICY member_sees_own_row ON public.project_members
  FOR SELECT
  USING (lower(email) = lower(auth.jwt()->>'email'));

-- 4. projects: members may read (writes stay owner-only via users_own_projects)
DROP POLICY IF EXISTS members_read_projects ON public.projects;
CREATE POLICY members_read_projects ON public.projects
  FOR SELECT
  USING (public.is_project_member(id));

-- 5. tasks: owner access becomes project-based; members get full task access
DROP POLICY IF EXISTS users_own_tasks ON public.tasks;
CREATE POLICY users_own_tasks ON public.tasks
  FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS members_manage_tasks ON public.tasks;
CREATE POLICY members_manage_tasks ON public.tasks
  FOR ALL
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

GRANT SELECT, INSERT, DELETE ON public.project_members TO authenticated;

COMMIT;
