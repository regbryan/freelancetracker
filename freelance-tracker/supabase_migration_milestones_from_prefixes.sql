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
-- SCOPED TO ONE OWNER. Every statement below is filtered to the projects of the
-- single account named in v_owner_email. This is a shared database: a broad
-- backfill would rewrite other users' task titles, which is not recoverable from
-- their side. The coordinator confirms this address with Reggie before running.
--
-- Idempotent-ish: a prefix that already has a milestone of the same name in
-- that project is skipped, and re-running finds nothing to do because the
-- prefixes are gone from the titles once linked. It does NOT undo itself (see
-- the commented restore in step 2), and it does not touch tasks that already
-- have a milestone_id.
--
-- No BEGIN/COMMIT: the migration tool wraps this in its own transaction, so the
-- backup in step 2 and the rewrite in step 4 commit or roll back together.

-- ===========================================================================
-- STEP 0 — PREVIEW. RUN THIS SELECT ON ITS OWN, FIRST, AND READ THE OUTPUT.
-- ===========================================================================
-- Every (project, prefix) pair this script would turn into a milestone. Check
-- that each `prefix` really is a phase of work and not something else that
-- happens to be bracketed ("[URGENT]", "[Client]", "[v2]") — those would become
-- milestones too, and the prefix would be stripped from the title. Fix or
-- re-title any of those BEFORE running the rest of the file.
WITH owner AS (SELECT id FROM auth.users WHERE email = 'reggie@inspiredideationstrategies.com')
SELECT p.name                                              AS project_name,
       btrim(substring(t.title FROM '^\[([^\]]+)\]'))      AS prefix,
       count(*)                                            AS task_count,
       least(min(t.start_date), min(t.due_date))           AS first_day,
       greatest(max(t.start_date), max(t.due_date))        AS last_day
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
WHERE p.user_id = (SELECT id FROM owner)
  AND t.milestone_id IS NULL
  AND t.title ~ '^\[[^\]]+\]'
GROUP BY p.name, btrim(substring(t.title FROM '^\[([^\]]+)\]'))
ORDER BY p.name, prefix;

-- ===========================================================================
-- STEP 1 — PRE-FLIGHT GUARD
-- ===========================================================================
-- Step 4 links a task to its milestone by matching name within a project. If a
-- project already has two milestones with the same (trimmed) name, that match is
-- ambiguous and the UPDATE would attach tasks to an arbitrary one of them. Stop
-- instead, and let a human decide which milestone the work belongs to.
-- Also stops if the owner email resolves to nobody: without that, every
-- statement below silently matches zero rows and the run "succeeds" doing nothing.
DO $$
DECLARE
  v_owner_email CONSTANT TEXT := 'reggie@inspiredideationstrategies.com';
  v_owner       UUID;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = v_owner_email;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'no auth.users row for %; confirm the owner email before running', v_owner_email;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.milestones m
    JOIN public.projects p ON p.id = m.project_id
    WHERE p.user_id = v_owner
    GROUP BY m.project_id, btrim(m.name)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate milestone names exist; resolve before backfill';
  END IF;
END $$;

-- ===========================================================================
-- STEP 2 — BACKUP (same transaction as the rewrite)
-- ===========================================================================
-- Step 4 rewrites `title` in place. Keep the original title and milestone_id of
-- every row it can touch, so a mistake is one UPDATE away from being undone
-- rather than a point-in-time restore of the whole database.
CREATE TABLE IF NOT EXISTS public.tasks_prefix_backup_20260902 AS
SELECT id, title, milestone_id, now() AS backed_up_at
FROM public.tasks
WHERE false;

-- The backup holds task titles, so it must not be readable through the API.
-- RLS on with no policies at all denies every non-superuser read and write;
-- the REVOKE keeps it out of PostgREST's schema exposure as well.
ALTER TABLE public.tasks_prefix_backup_20260902 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tasks_prefix_backup_20260902 FROM PUBLIC, anon, authenticated;

WITH owner AS (SELECT id FROM auth.users WHERE email = 'reggie@inspiredideationstrategies.com')
INSERT INTO public.tasks_prefix_backup_20260902 (id, title, milestone_id, backed_up_at)
SELECT t.id, t.title, t.milestone_id, now()
FROM public.tasks t
JOIN public.projects p ON p.id = t.project_id
WHERE p.user_id = (SELECT id FROM owner)
  AND t.title ~ '^\[[^\]]+\]'
  AND t.milestone_id IS NULL;

-- TO UNDO the title rewrite and the milestone links (before or after commit):
--
--   UPDATE public.tasks t
--   SET title = b.title, milestone_id = b.milestone_id
--   FROM public.tasks_prefix_backup_20260902 b
--   WHERE b.id = t.id;
--
-- The milestones created in step 3 are left behind by that; delete them by name
-- if they are not wanted (tasks.milestone_id is ON DELETE SET NULL, so removing
-- a milestone never removes work).

-- ===========================================================================
-- STEPS 3 & 4 — CREATE THE MILESTONES, THEN LINK AND CLEAN THE TASKS
-- ===========================================================================
DO $$
DECLARE
  v_owner   UUID;
  v_created INTEGER;
  v_linked  INTEGER;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'reggie@inspiredideationstrategies.com';

  -- 3. One milestone per (project, prefix) that does not have one yet.
  WITH prefixed AS (
    SELECT t.project_id,
           btrim(substring(t.title FROM '^\[([^\]]+)\]')) AS prefix,
           t.start_date,
           t.due_date
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE p.user_id = v_owner
      AND t.milestone_id IS NULL
      AND t.title ~ '^\[[^\]]+\]'
      -- A title that is nothing but its prefix ("[Discovery]") would be stripped
      -- to the empty string. Leave those alone entirely and report them instead.
      AND btrim(regexp_replace(t.title, '^\[[^\]]+\]\s*', '')) <> ''
      AND btrim(substring(t.title FROM '^\[([^\]]+)\]')) <> ''
  ),
  grouped AS (
    -- least/greatest across BOTH columns, not min(start)/max(due): a task whose
    -- dates are back to front would otherwise produce start_date > end_date and
    -- abort the whole run on the milestones_dates_ordered check constraint.
    -- Both ignore NULLs, so a group with no dates at all yields NULL/NULL, which
    -- the constraint allows and the Gantt reads as "span follows the tasks".
    SELECT project_id,
           prefix,
           least(min(start_date), min(due_date))    AS start_date,
           greatest(max(start_date), max(due_date)) AS end_date
    FROM prefixed
    GROUP BY project_id, prefix
  ),
  ranked AS (
    SELECT g.*,
           -- Offset by what the project already has: starting a backfilled phase
           -- at 0 would interleave it with milestones created by hand.
           (SELECT coalesce(max(m.sort_order), -1) FROM public.milestones m WHERE m.project_id = g.project_id)
             + (row_number() OVER (PARTITION BY g.project_id
                                   ORDER BY g.start_date NULLS LAST, g.prefix))::INTEGER AS sort_order
    FROM grouped g
  )
  INSERT INTO public.milestones (project_id, user_id, name, start_date, end_date, sort_order)
  SELECT r.project_id, p.user_id, r.prefix, r.start_date, r.end_date, r.sort_order
  FROM ranked r
  JOIN public.projects p ON p.id = r.project_id
  WHERE p.user_id = v_owner
    AND NOT EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.project_id = r.project_id AND btrim(m.name) = r.prefix
    );
  GET DIAGNOSTICS v_created = ROW_COUNT;

  -- 4. Link the tasks and drop the now-redundant prefix from their titles.
  --    Separate statement so it sees the milestones inserted above.
  UPDATE public.tasks t
  SET milestone_id = m.id,
      title = btrim(regexp_replace(t.title, '^\[[^\]]+\]\s*', ''))
  FROM public.milestones m, public.projects p
  WHERE p.id = t.project_id
    AND p.user_id = v_owner
    AND t.milestone_id IS NULL
    AND m.project_id = t.project_id
    AND btrim(m.name) = btrim(substring(t.title FROM '^\[([^\]]+)\]'))
    AND btrim(regexp_replace(t.title, '^\[[^\]]+\]\s*', '')) <> '';
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RAISE NOTICE 'milestones created: %, tasks linked: %', v_created, v_linked;
END $$;

-- ===========================================================================
-- STEP 5 — REPORT
-- ===========================================================================
-- All four counts are scoped to the same owner. `tasks_still_prefixed` should
-- equal `tasks_skipped_blank_title`: those keep their prefix by design, because
-- stripping it would leave them with no title at all. Any excess above that is
-- worth investigating before the transaction is committed.
WITH owner AS (SELECT id FROM auth.users WHERE email = 'reggie@inspiredideationstrategies.com'),
owned AS (
  SELECT t.id, t.title, t.milestone_id
  FROM public.tasks t
  JOIN public.projects p ON p.id = t.project_id
  WHERE p.user_id = (SELECT id FROM owner)
)
SELECT
  (SELECT count(*) FROM public.milestones m
     JOIN public.projects p ON p.id = m.project_id
    WHERE p.user_id = (SELECT id FROM owner))                       AS milestones_total,
  (SELECT count(*) FROM owned WHERE milestone_id IS NOT NULL)       AS tasks_linked,
  (SELECT count(*) FROM owned WHERE title ~ '^\[[^\]]+\]')          AS tasks_still_prefixed,
  (SELECT count(*) FROM owned
    WHERE title ~ '^\[[^\]]+\]'
      AND btrim(regexp_replace(title, '^\[[^\]]+\]\s*', '')) = '')  AS tasks_skipped_blank_title;
