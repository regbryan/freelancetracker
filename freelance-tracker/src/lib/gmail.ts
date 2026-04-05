// Gmail API helper module — client-side only, uses OAuth 2.0 redirect flow

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'gmail_access_token';
const EXPIRY_KEY = 'gmail_token_expiry';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
const API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() >= Number(expiry)) {
    clearAuth();
    return null;
  }
  return token;
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

function storeToken(accessToken: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000));
}

// ---------------------------------------------------------------------------
// OAuth redirect flow (no popup needed)
// ---------------------------------------------------------------------------

/**
 * Redirect the user to Google's OAuth consent page.
 * After consent, Google redirects back with the token in the URL hash.
 */
export function initGmailAuth(): Promise<string> {
  // Save current path so we can return after auth
  localStorage.setItem('gmail_auth_return', window.location.pathname);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: window.location.origin + '/settings',
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state: 'gmail_auth',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // This promise won't resolve — the page navigates away
  return new Promise(() => {});
}

/**
 * Call this on page load to check if we're returning from an OAuth redirect.
 * Returns true if a token was found and stored.
 */
export function handleOAuthRedirect(): boolean {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return false;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const state = params.get('state');

  if (state !== 'gmail_auth' || !accessToken || !expiresIn) return false;

  storeToken(accessToken, Number(expiresIn));

  // Clean the hash from the URL
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  return true;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function gmailFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Gmail');

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearAuth();
    throw new Error('Gmail token expired. Please re-authenticate.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      (errorBody as { error?: { message?: string } }).error?.message ||
        `Gmail API error: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Gmail API calls
// ---------------------------------------------------------------------------

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<{ id: string; threadId: string }> {
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const rawMessage = messageParts.join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payload: { raw: string; threadId?: string } = { raw: encoded };
  if (threadId) payload.threadId = threadId;

  return gmailFetch<{ id: string; threadId: string }>('/messages/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listMessages(
  query: string,
  maxResults: number = 20
): Promise<{ id: string; threadId: string }[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });

  const data = await gmailFetch<{
    messages?: { id: string; threadId: string }[];
  }>(`/messages?${params.toString()}`);

  return data.messages ?? [];
}

export async function getMessage(messageId: string): Promise<GmailMessage> {
  const data = await gmailFetch<{
    id: string;
    threadId: string;
    payload: {
      headers: { name: string; value: string }[];
      body?: { data?: string };
      parts?: { mimeType: string; body?: { data?: string }; parts?: { mimeType: string; body?: { data?: string } }[] }[];
    };
  }>(`/messages/${messageId}?format=full`);

  const header = (name: string) =>
    data.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  return {
    id: data.id,
    threadId: data.threadId,
    from: header('From'),
    to: header('To'),
    subject: header('Subject'),
    date: header('Date'),
    body: extractBody(data.payload),
  };
}

export async function syncEmails(clientEmail: string): Promise<GmailMessage[]> {
  const messages = await listMessages(`from:${clientEmail} OR to:${clientEmail}`);
  const results: GmailMessage[] = [];

  for (const msg of messages) {
    try {
      const parsed = await getMessage(msg.id);
      results.push(parsed);
    } catch {
      console.warn(`Failed to fetch message ${msg.id}`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Body extraction helpers
// ---------------------------------------------------------------------------

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

function extractBody(payload: {
  body?: { data?: string };
  parts?: { mimeType: string; body?: { data?: string }; parts?: { mimeType: string; body?: { data?: string } }[] }[];
}): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (!payload.parts) return '';

  const plainPart = findPart(payload.parts, 'text/plain');
  if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data);

  const htmlPart = findPart(payload.parts, 'text/html');
  if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data);

  return '';
}

function findPart(
  parts: { mimeType: string; body?: { data?: string }; parts?: { mimeType: string; body?: { data?: string } }[] }[],
  mimeType: string
): { body?: { data?: string } } | undefined {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part;
    if (part.parts) {
      const nested = findPart(part.parts as typeof parts, mimeType);
      if (nested) return nested;
    }
  }
  return undefined;
}
