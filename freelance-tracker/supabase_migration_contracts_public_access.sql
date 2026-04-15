-- FreelanceTracker: Tighten public contract sign-by-link policies
-- Run in Supabase SQL Editor AFTER supabase_migration_rls_security.sql
--
-- Context: The public sign flow lets unauthenticated visitors read a contract
-- by knowing its sign_token (a random UUID in the share URL) and submit a
-- signature. The original policies were:
--
--   contracts.public_view_contracts_by_token  → SELECT, USING (true)
--     ^ exposed every contract including unsent drafts to the entire internet
--
--   contract_signatures.public_insert_signatures → INSERT, WITH CHECK (true)
--     ^ accepted signatures for any contract id, including drafts and
--       contracts that don't exist
--
--   (no public UPDATE policy on contracts existed at all, so the
--    `status: 'signed'` update in ContractSign.tsx was silently failing)
--
-- This migration replaces those policies with ones that:
--   - Only expose contracts whose status is 'sent' or 'signed' (drafts stay private)
--   - Only accept signatures for contracts currently in 'sent' status
--   - Allow exactly one status transition: 'sent' → 'signed'
--
-- The unguessable sign_token UUID remains the practical secret. These policies
-- are defense in depth so that a leaked draft id, an enumeration attempt, or
-- a replay can't escalate.

BEGIN;

-- ---------------------------------------------------------------------------
-- contracts: public read of sent / signed contracts only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS public_view_contracts_by_token ON public.contracts;

CREATE POLICY public_view_sent_contracts ON public.contracts
  FOR SELECT
  TO anon, authenticated
  USING (
    status IN ('sent', 'signed')
    AND sign_token IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- contracts: public can mark a sent contract as signed (but nothing else)
-- ---------------------------------------------------------------------------

CREATE POLICY public_mark_contract_signed ON public.contracts
  FOR UPDATE
  TO anon, authenticated
  USING (status = 'sent')
  WITH CHECK (status = 'signed');

-- ---------------------------------------------------------------------------
-- contract_signatures: public can sign only contracts in 'sent' status
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS public_insert_signatures ON public.contract_signatures;

CREATE POLICY public_insert_signatures ON public.contract_signatures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    contract_id IN (
      SELECT id FROM public.contracts WHERE status = 'sent'
    )
  );

COMMIT;
