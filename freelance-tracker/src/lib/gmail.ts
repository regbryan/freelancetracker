// Gmail helper module — PKCE auth code flow + Supabase Edge Function proxy.
//
// All Gmail API calls go through the `gmail` Edge Function. The frontend never
// touches a Google access token or refresh token. The Edge Function holds the
// Google client secret and stores refresh tokens in public.gmail_tokens
// (service_role only).
//
// Local state kept in this module:
//   - A cached boolean ("is the user connected?") for synchronous reads from
//     components that haven't wired into the useGmail hook yet.
//   - A PKCE code_verifier stored in sessionStorage between the redirect to
//     Google and the return.
//
// Flow:
//   1. User clicks "Connect Gmail" → initGmailAuth()
//        - Generate code_verifier (random) + code_challenge (SHA-256)
//        - sessionStorage.setItem('gmail_pkce_verifier', verifier)
//        - window.location = Google consent URL (response_type=code, S256)
//   2. Google redirects back with ?code=... &state=gmail_auth
//   3. handleOAuthRedirect() reads the code, POSTs to the edge function
//      ('exchange'), and the function stores the refresh token server-side.

import { supabase } from './supabase';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES =
  'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
const PKCE_VERIFIER_KEY = 'gmail_pkce_verifier';

// ---------------------------------------------------------------------------
// Cached auth state — so components can render synchronously
// ---------------------------------------------------------------------------

let cachedConnected = false;
let cachedEmail: string | null = null;
const listeners = new Set<() => void>();

function setConnected(connected: boolean, email: string | null = null) {
  if (cachedConnected === connected && cachedEmail === email) return;
  cachedConnected = connected;
  cachedEmail = email;
  for (const listener of listeners) listener();
}

export function isAuthenticated(): boolean {
  return cachedConnected;
}

export function getConnectedEmail(): string | null {
  return cachedEmail;
}

export function subscribeGmail(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// Edge Function invoke helper
// ---------------------------------------------------------------------------

async function invokeGmail<T = unknown>(
  body: Record<string, unknown>,
): Promise<T> {
  // Ensure the Supabase session is loaded from localStorage before invoking.
  // On a fresh page load the client may not have restored the JWT yet —
  // without this, functions.invoke() sends no Authorization header → 401.
  const { data: { session } } = await supabase.auth.getSession();

  // If a session exists, explicitly pass the access token so we never rely on
  // the internal header state of the supabase client being up-to-date.
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const { data, error } = await supabase.functions.invoke('gmail', {
    body,
    headers,
  });
  if (error) {
    // supabase-js wraps the response body inside FunctionsHttpError — try to
    // surface the original { error: "..." } message from the edge function.
    type MaybeHttpError = { context?: { json?: () => Promise<{ error?: string }> } };
    const ctx = (error as MaybeHttpError).context;
    let edgeFnMessage: string | undefined;
    if (ctx?.json) {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) edgeFnMessage = parsed.error;
      } catch {
        // JSON parsing failed — fall through to generic message
      }
    }
    throw new Error(edgeFnMessage || error.message || 'Gmail request failed');
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const data = await invokeGmail<{ connected: boolean; email?: string }>({
      action: 'status',
    });
    setConnected(!!data.connected, data.email ?? null);
    return !!data.connected;
  } catch {
    setConnected(false, null);
    return false;
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await invokeGmail({ action: 'disconnect' });
  } finally {
    setConnected(false, null);
  }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function getRedirectUri(): string {
  return window.location.origin + '/settings';
}

// ---------------------------------------------------------------------------
// OAuth — PKCE auth code flow
// ---------------------------------------------------------------------------

/**
 * Redirect the user to Google's OAuth consent page using PKCE + auth code flow.
 * Navigation happens once the code_challenge has been computed — this is a
 * top-level navigation, not a popup, so the user gesture requirement does not
 * block it even though the function is async.
 */
export async function initGmailAuth(): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: 'gmail_auth',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Handle the ?code=... return from Google. If a code is present, exchange it
 * via the edge function (which stores the refresh token server-side) and
 * return true. Otherwise return false.
 */
export async function handleOAuthRedirect(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    // Clean the error out of the URL and surface it
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState(null, '', url.pathname + url.search);
    throw new Error(`Google auth error: ${errorParam}`);
  }

  if (!code || state !== 'gmail_auth') return false;

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  // Strip auth params from the URL regardless of success
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('scope');
  url.searchParams.delete('authuser');
  url.searchParams.delete('prompt');
  window.history.replaceState(null, '', url.pathname + url.search);

  if (!verifier) {
    throw new Error('Missing PKCE verifier — please try connecting again');
  }

  // invokeGmail now handles session restoration internally — no need to
  // manually call getSession() here.

  const result = await invokeGmail<{ connected: boolean; email?: string }>({
    action: 'exchange',
    code,
    code_verifier: verifier,
    redirect_uri: getRedirectUri(),
  });

  setConnected(!!result.connected, result.email ?? null);
  return !!result.connected;
}

// ---------------------------------------------------------------------------
// Gmail API calls — all proxied through the edge function
// ---------------------------------------------------------------------------

export interface EmailAttachment {
  filename: string;
  /** Standard base64-encoded file content (not base64url). */
  data: string;
  mimeType?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  attachments?: EmailAttachment[],
  cc?: string,
  bcc?: string,
): Promise<{ id: string; threadId: string }> {
  return invokeGmail<{ id: string; threadId: string }>({
    action: 'send',
    to,
    subject,
    body,
    threadId,
    attachments,
    cc,
    bcc,
  });
}

export async function listMessages(
  query: string,
  maxResults = 20,
): Promise<{ id: string; threadId: string }[]> {
  const data = await invokeGmail<{ messages: { id: string; threadId: string }[] }>({
    action: 'list',
    query,
    maxResults,
  });
  return data.messages ?? [];
}

export async function getMessage(messageId: string): Promise<GmailMessage> {
  return invokeGmail<GmailMessage>({ action: 'get', messageId });
}

export async function syncEmails(clientEmail: string): Promise<GmailMessage[]> {
  const data = await invokeGmail<{ messages: GmailMessage[] }>({
    action: 'search',
    clientEmail,
  });
  return data.messages ?? [];
}
