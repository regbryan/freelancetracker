-- FreelanceTracker: one-time backfill of milestones from bracketed task titles
-- Spec: docs/superpowers/specs/2026-09-01-timeline-project-manager-design.md
--       (Revision 2026-09-02 (b) — Milestones layer)
--
-- RUN ONCE, BY THE OWNER, AFTER supabase_migration_milestones.sql.
-- The existing data encodes phases as a bracketed title prefix
-- ("[Discovery] Kick-off call"). For each (project, prefix) group this creates
-- a milestone named after the prefix, spanning the group's earliest to latest
-- task date, ordered by that first date within the project; then it points the
-- group's tasks at the milestone and strips the prefix from their titles.
--
-- Idempotent-ish: a prefix that already has a milestone of the same name in
-- that project is skipped, and re-running finds nothing to do because the
-- prefixes are gone from the titles once linked. It does NOT undo itself, and
-- it does not touch tasks that already have a milestone_id.
--
-- No BEGIN/COMMIT: the migration tool wraps this in its own transaction.

DO $$
DECLARE
  v_created INTEGER;
  v_linked  INTEGER;
BEGIN
  -- 1. One milestone per (project, prefix) that does not have one yet.
  WITH prefixed AS (
    SELECT t.project_id,
           substring(t.title FROM '^\[([^\]]+)\]') AS prefix,
           t.start_date,
           t.due_date
    FROM public.tasks t
    WHERE t.milestone_id IS NULL
      AND substring(t.title FROM '^\[([^\]]+)\]') IS NOT NULL
  ),
  grouped AS (
    SELECT project_id,
           prefix,
           min(coalesce(start_date, due_date)) AS start_date,
           max(coalesce(due_date, start_date)) AS end_date
    FROM prefixed
    GROUP BY project_id, prefix
  ),
  ranked AS (
    SELECT g.*,
           (row_number() OVER (PARTITION BY g.project_id
                               ORDER BY g.start_date NULLS LAST, g.prefix))::INTEGER - 1 AS sort_order
    FROM grouped g
  )
  INSERT INTO public.milestones (project_id, user_id, name, start_date, end_date, sort_order)
  SELECT r.project_id, p.user_id, r.prefix, r.start_date, r.end_date, r.sort_order
  FROM ranked r
  JOIN public.projects p ON p.id = r.project_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.milestones m
    WHERE m.project_id = r.project_id AND m.name = r.prefix
  );
  GET DIAGNOSTICS v_created = ROW_COUNT;

  -- 2. Link the tasks and drop the now-redundant prefix from their titles.
  --    Separate statement so it sees the milestones inserted above.
  UPDATE public.tasks t
  SET milestone_id = m.id,
      title = regexp_replace(t.title, '^\[[^\]]+\]\s*', '')
  FROM public.milestones m
  WHERE t.milestone_id IS NULL
    AND m.project_id = t.project_id
    AND m.name = substring(t.title FROM '^\[([^\]]+)\]');
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RAISE NOTICE 'milestones created: %, tasks linked: %', v_created, v_linked;
END $$;

-- Report: milestones now on file, tasks pointing at one, and any task that
-- still carries a bracketed prefix (should be 0 -- investigate if it is not).
SELECT
  (SELECT count(*) FROM public.milestones)                                    AS milestones_total,
  (SELECT count(*) FROM public.tasks WHERE milestone_id IS NOT NULL)          AS tasks_linked,
  (SELECT count(*) FROM public.tasks WHERE title ~ '^\[[^\]]+\]')             AS tasks_still_prefixed;
