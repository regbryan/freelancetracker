// Supabase Edge Function: ai-search
//
// Authenticated proxy for the LLM-backed email search. The browser
// never calls the upstream LLM proxy directly; it calls this function,
// which validates the caller's Supabase JWT and then forwards the
// request to the upstream service.
//
// Why this exists:
//   - Attributes every LLM call to a specific user.id (audit + abuse handling)
//   - Lets us rate-limit per user (TODO below)
//   - Keeps any upstream API key server-side (LLM_PROXY_API_KEY secret)
//   - Lets us swap the upstream provider via env var without shipping a new build
//
// Required function secrets:
//   LLM_PROXY_URL          full URL including path, e.g. https://unified-calendar-eight.vercel.app/api/parse-receipt
//   LLM_PROXY_API_KEY      optional; if set, forwarded as Authorization: Bearer <key>
//   SUPABASE_SECRET_KEY    preferred; falls back to SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy ai-search --no-verify-jwt
//   supabase secrets set LLM_PROXY_URL=https://...
//   supabase secrets set LLM_PROXY_API_KEY=...   # if/when upstream supports it

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LLM_PROXY_URL = Deno.env.get('LLM_PROXY_URL');
const LLM_PROXY_API_KEY = Deno.env.get('LLM_PROXY_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const { data } = await admin.auth.getUser(token);
  return data?.user?.id ?? null;
}

interface EmailInput {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
}

interface AiSearchRequest {
  query: string;
  emails: EmailInput[];
}

function isValidRequest(body: unknown): body is AiSearchRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.query !== 'string' || !b.query.trim()) return false;
  if (!Array.isArray(b.emails)) return false;
  if (b.emails.length === 0 || b.emails.length > 500) return false;
  return b.emails.every((e: unknown) => {
    if (!e || typeof e !== 'object') return false;
    const x = e as Record<string, unknown>;
    return (
      typeof x.id === 'string' &&
      typeof x.subject === 'string' &&
      typeof x.from === 'string' &&
      typeof x.to === 'string' &&
      typeof x.date === 'string' &&
      typeof x.snippet === 'string'
    );
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return error('Method not allowed', 405);
  if (!LLM_PROXY_URL) return error('ai-search not configured: LLM_PROXY_URL secret missing', 500);

  const userId = await getUserId(req);
  if (!userId) return error('Unauthorized', 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body');
  }

  if (!isValidRequest(body)) {
    return error('Invalid request shape: expected { query: string, emails: EmailInput[] }');
  }

  // Forward to upstream proxy with optional API key.
  const upstreamHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (LLM_PROXY_API_KEY) upstreamHeaders['Authorization'] = `Bearer ${LLM_PROXY_API_KEY}`;

  // Abort if upstream is slow.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: upstreamHeaders,
      // Preserve the legacy `action` field so the existing upstream proxy still dispatches correctly.
      body: JSON.stringify({ action: 'email-search', ...body }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[ai-search] Non-JSON upstream response:', text.slice(0, 200));
      return error('Upstream returned non-JSON response', 502);
    }

    if (!upstream.ok) {
      const upstreamError =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Upstream ${upstream.status}`;
      return error(upstreamError, upstream.status);
    }

    // Minimal audit log (Supabase captures console output).
    console.log(`[ai-search] user=${userId} emails=${(body as AiSearchRequest).emails.length}`);

    return json(data);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return error('Upstream timed out after 30s', 504);
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error('[ai-search] Forward failed:', message);
    return error(message, 500);
  } finally {
    clearTimeout(timeoutId);
  }
});
