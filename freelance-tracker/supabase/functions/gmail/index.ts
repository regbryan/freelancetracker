// Supabase Edge Function: gmail
//
// Server-side proxy for all Gmail API calls. The frontend never touches a
// Gmail access token or refresh token. This function:
//
//   - Verifies the caller's Supabase JWT (verify_jwt: true)
//   - Holds Google OAuth client_secret as a function secret
//   - Stores refresh tokens in public.gmail_tokens (service_role only)
//   - Transparently refreshes access tokens when expired
//   - Proxies send / list / get / search calls to Gmail
//
// Actions (POST body { action: "...", ... }):
//   exchange    { code, code_verifier, redirect_uri }  → stores tokens
//   status      {}                                       → { connected, email, scope }
//   disconnect  {}                                       → deletes tokens + revokes with Google
//   send        { to, subject, body, threadId? }         → sends mail
//   list        { query, maxResults? }                   → returns [{id, threadId}]
//   get         { messageId }                            → returns parsed GmailMessage
//   search      { clientEmail }                          → sync helper: list + get in one call
//
// Required function secrets (set via `supabase secrets set` or dashboard):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//
// Auto-provided by Supabase runtime:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailFullMessage {
  id: string;
  threadId: string;
  payload: {
    headers: GmailMessageHeader[];
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
}

// ---------------------------------------------------------------------------
// Supabase admin client (service_role — bypasses RLS)
// ---------------------------------------------------------------------------

const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Auth — resolve the caller's user id from the Supabase JWT
// ---------------------------------------------------------------------------

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length);
  const { data, error: authError } = await admin.auth.getUser(token);
  if (authError || !data.user) return null;
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID!,
    client_secret: GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    client_secret: GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

/**
 * Returns a valid access token for the given user, refreshing from Google
 * if the stored one is missing, expired, or within 60s of expiry.
 */
async function getAccessTokenForUser(userId: string): Promise<string> {
  const { data: row, error: rowError } = await admin
    .from('gmail_tokens')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (rowError) throw new Error(`DB error: ${rowError.message}`);
  if (!row) throw new Error('Gmail not connected for this user');

  const now = Date.now();
  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at).getTime()
    : 0;

  if (row.access_token && expiresAt - 60_000 > now) {
    return row.access_token;
  }

  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiresAt = new Date(now + refreshed.expires_in * 1000).toISOString();

  const { error: updateError } = await admin
    .from('gmail_tokens')
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) throw new Error(`DB update error: ${updateError.message}`);

  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Gmail API helpers
// ---------------------------------------------------------------------------

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function extractBody(payload: GmailFullMessage['payload']): string {
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (!payload.parts) return '';

  const findPart = (
    parts: GmailMessagePart[],
    mimeType: string,
  ): GmailMessagePart | undefined => {
    for (const part of parts) {
      if (part.mimeType === mimeType) return part;
      if (part.parts) {
        const nested = findPart(part.parts, mimeType);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  const plain = findPart(payload.parts, 'text/plain');
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);

  const html = findPart(payload.parts, 'text/html');
  if (html?.body?.data) return decodeBase64Url(html.body.data);

  return '';
}

function parseMessage(full: GmailFullMessage): GmailMessage {
  const header = (name: string) =>
    full.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? '';

  return {
    id: full.id,
    threadId: full.threadId,
    from: header('From'),
    to: header('To'),
    subject: header('Subject'),
    date: header('Date'),
    body: extractBody(full.payload),
  };
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleExchange(userId: string, body: Record<string, unknown>) {
  const code = body.code as string | undefined;
  const codeVerifier = body.code_verifier as string | undefined;
  const redirectUri = body.redirect_uri as string | undefined;

  if (!code || !codeVerifier || !redirectUri) {
    return error('code, code_verifier, and redirect_uri are required');
  }

  const tokens = await exchangeCode(code, codeVerifier, redirectUri);

  if (!tokens.refresh_token) {
    return error(
      'Google did not return a refresh token. The user may have previously granted access without full consent — have them revoke access at myaccount.google.com/permissions and try again.',
      400,
    );
  }

  // Fetch the connected Gmail address so we can display it in the UI
  let connectedEmail: string | null = null;
  try {
    const profile = await gmailFetch<{ emailAddress: string }>(
      tokens.access_token,
      '/profile',
    );
    connectedEmail = profile.emailAddress;
  } catch {
    // Non-fatal — we still have the tokens
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: upsertError } = await admin.from('gmail_tokens').upsert({
    user_id: userId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expires_at: expiresAt,
    scope: tokens.scope,
    connected_email: connectedEmail,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) return error(`DB error: ${upsertError.message}`, 500);

  return json({ connected: true, email: connectedEmail, scope: tokens.scope });
}

async function handleStatus(userId: string) {
  const { data: row, error: rowError } = await admin
    .from('gmail_tokens')
    .select('connected_email, scope, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (rowError) return error(`DB error: ${rowError.message}`, 500);

  if (!row) return json({ connected: false });

  return json({
    connected: true,
    email: row.connected_email,
    scope: row.scope,
    updated_at: row.updated_at,
  });
}

async function handleDisconnect(userId: string) {
  const { data: row } = await admin
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (row?.refresh_token) {
    // Best-effort revoke with Google — don't fail if Google is unreachable
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`,
        { method: 'POST' },
      );
    } catch {
      // ignore
    }
  }

  const { error: deleteError } = await admin
    .from('gmail_tokens')
    .delete()
    .eq('user_id', userId);

  if (deleteError) return error(`DB error: ${deleteError.message}`, 500);

  return json({ connected: false });
}

async function handleSend(userId: string, body: Record<string, unknown>) {
  const to = body.to as string | undefined;
  const subject = body.subject as string | undefined;
  const text = body.body as string | undefined;
  const threadId = body.threadId as string | undefined;

  if (!to || !subject || text === undefined) {
    return error('to, subject, and body are required');
  }

  const accessToken = await getAccessTokenForUser(userId);

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    text,
  ];
  const rawMessage = messageParts.join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payload: { raw: string; threadId?: string } = { raw: encoded };
  if (threadId) payload.threadId = threadId;

  const result = await gmailFetch<{ id: string; threadId: string }>(
    accessToken,
    '/messages/send',
    { method: 'POST', body: JSON.stringify(payload) },
  );

  return json(result);
}

async function handleList(userId: string, body: Record<string, unknown>) {
  const query = body.query as string | undefined;
  const maxResults = (body.maxResults as number | undefined) ?? 20;

  if (!query) return error('query is required');

  const accessToken = await getAccessTokenForUser(userId);
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });

  const data = await gmailFetch<{
    messages?: { id: string; threadId: string }[];
  }>(accessToken, `/messages?${params.toString()}`);

  return json({ messages: data.messages ?? [] });
}

async function handleGet(userId: string, body: Record<string, unknown>) {
  const messageId = body.messageId as string | undefined;
  if (!messageId) return error('messageId is required');

  const accessToken = await getAccessTokenForUser(userId);
  const full = await gmailFetch<GmailFullMessage>(
    accessToken,
    `/messages/${messageId}?format=full`,
  );

  return json(parseMessage(full));
}

async function handleSearch(userId: string, body: Record<string, unknown>) {
  const clientEmail = body.clientEmail as string | undefined;
  const maxResults = (body.maxResults as number | undefined) ?? 20;
  if (!clientEmail) return error('clientEmail is required');

  const accessToken = await getAccessTokenForUser(userId);
  const params = new URLSearchParams({
    q: `from:${clientEmail} OR to:${clientEmail}`,
    maxResults: String(maxResults),
  });

  const list = await gmailFetch<{
    messages?: { id: string; threadId: string }[];
  }>(accessToken, `/messages?${params.toString()}`);

  const ids = (list.messages ?? []).map((m) => m.id);
  const results: GmailMessage[] = [];

  // Serial fetch — Gmail rate-limits aggressive parallel fetches
  for (const id of ids) {
    try {
      const full = await gmailFetch<GmailFullMessage>(
        accessToken,
        `/messages/${id}?format=full`,
      );
      results.push(parseMessage(full));
    } catch (e) {
      console.warn(`Failed to fetch message ${id}:`, e);
    }
  }

  return json({ messages: results });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return error('Method not allowed', 405);
  }

  const userId = await getUserId(req);
  if (!userId) return error('Unauthorized', 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body');
  }

  const action = body.action as string | undefined;
  if (!action) return error('action is required');

  try {
    switch (action) {
      case 'exchange':
        return await handleExchange(userId, body);
      case 'status':
        return await handleStatus(userId);
      case 'disconnect':
        return await handleDisconnect(userId);
      case 'send':
        return await handleSend(userId, body);
      case 'list':
        return await handleList(userId, body);
      case 'get':
        return await handleGet(userId, body);
      case 'search':
        return await handleSearch(userId, body);
      default:
        return error(`Unknown action: ${action}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Action ${action} failed:`, message);
    return error(message, 500);
  }
});
