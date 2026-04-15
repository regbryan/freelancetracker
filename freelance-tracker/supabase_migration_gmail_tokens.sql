-- FreelanceTracker: Server-side Gmail OAuth token storage
-- Run in Supabase SQL Editor
--
-- Replaces the old "access token in localStorage" model. Refresh tokens and
-- access tokens now live here, readable only by the Edge Function using the
-- service_role key. The frontend never touches these rows directly.
--
-- To check whether a user has a connected Gmail account, the frontend calls
-- the `gmail` Edge Function with `action: 'status'`, which does the lookup
-- server-side and returns only the connected email address.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  connected_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Deliberately no SELECT / INSERT / UPDATE / DELETE policies for anon or
-- authenticated roles. All access goes through the Edge Function using the
-- service_role key, which bypasses RLS. This keeps refresh tokens out of
-- any path that could be reached via a leaked anon key or an XSS-hijacked
-- session.

COMMIT;
