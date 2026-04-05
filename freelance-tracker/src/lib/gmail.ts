// Gmail API helper module — client-side only, uses Google Identity Services (GIS)

// ---------------------------------------------------------------------------
// Type declarations for Google Identity Services (loaded via script tag)
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

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
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';
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
  // Store expiry with a 60-second buffer so we refresh before it actually expires
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000));
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

export function initGmailAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library not loaded. Make sure the GIS script tag is in index.html.'));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: TokenResponse) => {
        if (response.error) {
          alert('OAuth error: ' + (response.error_description || response.error));
          reject(new Error(response.error_description || response.error));
          return;
        }
        storeToken(response.access_token, response.expires_in);
        alert('Gmail connected! Token saved.');
        resolve(response.access_token);
      },
      error_callback: (error) => {
        alert('OAuth error_callback: ' + (error.message || 'Unknown error'));
        reject(new Error(error.message || 'OAuth error'));
      },
    });

    client.requestAccessToken({ prompt: 'consent' });
  });
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

/**
 * Send an email. Optionally include a threadId to reply within an existing thread.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<{ id: string; threadId: string }> {
  // Build an RFC 2822 message
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const rawMessage = messageParts.join('\r\n');

  // Base64url encode
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

/**
 * List message ids matching a Gmail search query.
 */
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

/**
 * Get a single message by id, parsed into a friendly shape.
 */
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

/**
 * Sync emails for a given client email address (from + to).
 */
export async function syncEmails(clientEmail: string): Promise<GmailMessage[]> {
  const messages = await listMessages(`from:${clientEmail} OR to:${clientEmail}`);
  const results: GmailMessage[] = [];

  for (const msg of messages) {
    try {
      const parsed = await getMessage(msg.id);
      results.push(parsed);
    } catch {
      // Skip messages that fail to parse
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
  // Simple body (non-multipart)
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (!payload.parts) return '';

  // Prefer text/plain, fall back to text/html
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
