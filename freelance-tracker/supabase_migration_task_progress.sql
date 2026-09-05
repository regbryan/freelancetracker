-- FreelanceTracker: task percent complete and estimated hours
-- Spec: docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md
--       (Revision 2026-09-05 (d) — the bar is the control)
--
-- Adds tasks.progress (0-100) and tasks.estimate_hours. The Gantt draws the
-- percentage as a darker fill inside each bar and prints it beside the bar;
-- milestone and project percentages are the mean of their tasks' progress,
-- computed app-side in src/lib/progress.ts. estimate_hours is what the bar
-- popover shows against the hours actually logged against the task in
-- time_entries -- "logged / estimate h" -- rolled up on milestone and project
-- rows. Nullable: most tasks are never estimated, and 0 would be a lie.
--
-- Status and progress stay in step app-side: setting progress to 100 marks the
-- task done, and dropping a done task below 100 reopens it as in_progress. The
-- backfill below applies the same rule once to the rows that already exist, so
-- a finished task does not open at 0%.
--
-- portal_tasks gains progress as its last column: the client portal shows the
-- percentage, and CREATE OR REPLACE VIEW can only add columns at the end.
-- Assignee and hours are deliberately still not exposed to the portal -- a
-- client reads how far along the work is, not who is on it or what it costs.
--
-- Until this runs the app treats a missing progress as 0 and a missing
-- estimate as null, and an update that includes either column fails with
-- 42703; useTasks re-throws that as 'migration-pending' so the Timeline page
-- can say which file is missing.
--
-- No BEGIN/COMMIT: the migration tool wraps this in its own transaction.

-- 1. Columns -----------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS progress SMALLINT NOT NULL DEFAULT 0
  CHECK (progress BETWEEN 0 AND 100);

-- Nullable, and never negative. NUMERIC(6,2) tops out at 9999.99 hours, which
-- is five working years on one task -- far past anything a freelancer bills.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC(6,2)
  CHECK (estimate_hours IS NULL OR estimate_hours >= 0);

-- 2. Backfill ----------------------------------------------------------------
-- Only the untouched rows: a task already carrying a percentage keeps it.
UPDATE public.tasks SET progress = 100 WHERE status = 'done' AND progress = 0;

-- 3. Portal view -------------------------------------------------------------
-- Same definition as in supabase_migration_milestones.sql with progress
-- appended -- CREATE OR REPLACE VIEW can add columns at the end but cannot
-- reorder or retype the existing ones, so the new column must stay last.
-- Definer semantics, like the other portal_* views: they run as the view owner
-- and bypass base-table RLS, so the email predicate below is the entire access
-- control. Do NOT flip this to security_invoker = true.
CREATE OR REPLACE VIEW public.portal_tasks
WITH (security_invoker = false, security_barrier = true) AS
SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority,
       t.start_date, t.due_date, t.updated_at, t.milestone_id, t.progress
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
JOIN public.clients c ON c.id = p.client_id
WHERE c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND lower(c.email) = lower(auth.jwt()->>'email');

REVOKE ALL ON public.portal_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.portal_tasks TO authenticated;
