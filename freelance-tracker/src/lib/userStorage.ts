import { supabase } from './supabase';

// Tracks the current user id so synchronous localStorage helpers can namespace.
let currentUserId: string | null = bootstrapUserIdFromStorage();

// Synchronously read the persisted Supabase session so userStorage works on
// first render before the async auth listener fires.
function bootstrapUserIdFromStorage(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const id = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
      if (typeof id === 'string') return id;
    }
  } catch { /* ignore */ }
  return null;
}

supabase.auth.getSession().then(({ data: { session } }) => {
  currentUserId = session?.user?.id ?? null;
  migrateLegacyKeysOnce();
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUserId = session?.user?.id ?? null;
  migrateLegacyKeysOnce();
});

const NAMESPACED_KEYS = [
  'freelancer_photo',
  'freelancer_logo',
  'freelancer_profile',
] as const;

type NamespacedKey = (typeof NAMESPACED_KEYS)[number];

function scoped(key: NamespacedKey): string | null {
  if (!currentUserId) return null;
  return `${key}_${currentUserId}`;
}

// One-time migration: if the user has no scoped value but a legacy unscoped one
// exists, copy it into their namespace and remove the legacy entry. Runs only
// once per user per browser.
function migrateLegacyKeysOnce(): void {
  if (!currentUserId) return;
  const flag = `freelancer_migrated_${currentUserId}`;
  if (localStorage.getItem(flag)) return;
  for (const key of NAMESPACED_KEYS) {
    const scopedKey = `${key}_${currentUserId}`;
    if (localStorage.getItem(scopedKey) !== null) continue;
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      localStorage.setItem(scopedKey, legacy);
    }
  }
  // Remove legacy values so other accounts on this browser don't inherit them.
  for (const key of NAMESPACED_KEYS) {
    localStorage.removeItem(key);
  }
  localStorage.setItem(flag, '1');
}

export const userStorage = {
  get(key: NamespacedKey): string | null {
    const k = scoped(key);
    return k ? localStorage.getItem(k) : null;
  },
  set(key: NamespacedKey, value: string): void {
    const k = scoped(key);
    if (k) localStorage.setItem(k, value);
  },
  remove(key: NamespacedKey): void {
    const k = scoped(key);
    if (k) localStorage.removeItem(k);
  },
};
