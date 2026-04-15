-- FreelanceTracker: RLS Security Hardening
-- Run in Supabase SQL Editor
--
-- Context: Six tables had legacy "Allow all" policies (USING true / WITH CHECK true)
-- that coexisted with proper users_own_* policies. Because RLS is permissive (OR'd),
-- the "Allow all" policies made the strict ones meaningless — anyone with the anon
-- key (which is shipped to the browser) could read or modify the entire database.
--
-- This migration:
--   1. Drops the "Allow all" policies on 6 tables.
--   2. Adds user_id to public.communications (which had no ownership column),
--      backfills it from projects.user_id, and creates a proper RLS policy.
--   3. Tightens the existing users_own_* policies with explicit WITH CHECK clauses
--      so INSERTs cannot smuggle in rows owned by another user.
--
-- NOT touched (intentional public-access flows — review separately):
--   - public.contracts.public_view_contracts_by_token  (public sign-by-link page)
--   - public.contract_signatures.public_insert_signatures  (unauthenticated signing)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Drop legacy "Allow all" policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all" ON public.clients;
DROP POLICY IF EXISTS "Allow all" ON public.communications;
DROP POLICY IF EXISTS "Allow all" ON public.invoice_items;
DROP POLICY IF EXISTS "Allow all" ON public.invoices;
DROP POLICY IF EXISTS "Allow all" ON public.projects;
DROP POLICY IF EXISTS "Allow all" ON public.time_entries;

-- ---------------------------------------------------------------------------
-- 2. Add ownership to public.communications
-- ---------------------------------------------------------------------------

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill existing rows from the parent project's owner
UPDATE public.communications c
SET user_id = p.user_id
FROM public.projects p
WHERE c.project_id = p.id
  AND c.user_id IS NULL;

-- New rows default to the calling user (the hook does not need to pass user_id)
ALTER TABLE public.communications
  ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_communications_user_id
  ON public.communications(user_id);

-- ---------------------------------------------------------------------------
-- 3. Recreate ownership policies with explicit WITH CHECK
-- ---------------------------------------------------------------------------
-- These policies already existed but lacked WITH CHECK, meaning an INSERT could
-- write a row with someone else's user_id. Recreating them with WITH CHECK
-- closes that gap.

DROP POLICY IF EXISTS users_own_clients ON public.clients;
CREATE POLICY users_own_clients ON public.clients
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_projects ON public.projects;
CREATE POLICY users_own_projects ON public.projects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_invoices ON public.invoices;
CREATE POLICY users_own_invoices ON public.invoices
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_time_entries ON public.time_entries;
CREATE POLICY users_own_time_entries ON public.time_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_expenses ON public.expenses;
CREATE POLICY users_own_expenses ON public.expenses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_tasks ON public.tasks;
CREATE POLICY users_own_tasks ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_contracts ON public.contracts;
CREATE POLICY users_own_contracts ON public.contracts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_meeting_notes ON public.meeting_notes;
CREATE POLICY users_own_meeting_notes ON public.meeting_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Child tables: ownership flows through the parent

DROP POLICY IF EXISTS users_own_invoice_items ON public.invoice_items;
CREATE POLICY users_own_invoice_items ON public.invoice_items
  FOR ALL
  USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid())
  )
  WITH CHECK (
    invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS users_own_meeting_topics ON public.meeting_topics;
CREATE POLICY users_own_meeting_topics ON public.meeting_topics
  FOR ALL
  USING (
    meeting_note_id IN (SELECT id FROM public.meeting_notes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    meeting_note_id IN (SELECT id FROM public.meeting_notes WHERE user_id = auth.uid())
  );

-- New policy for communications (replaces the dropped "Allow all")
CREATE POLICY users_own_communications ON public.communications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
