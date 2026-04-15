import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  initGmailAuth,
  handleOAuthRedirect,
  checkAuthStatus,
  clearAuth,
  isAuthenticated as readCached,
  getConnectedEmail,
  subscribeGmail,
} from '../lib/gmail';

export function useGmail() {
  // Subscribe to the module-level cached auth state so every consumer stays
  // in sync when one of them triggers a connect / disconnect.
  const authenticated = useSyncExternalStore(
    subscribeGmail,
    readCached,
    () => false,
  );
  const email = useSyncExternalStore(
    subscribeGmail,
    getConnectedEmail,
    () => null,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: (1) handle OAuth redirect if present, (2) refresh status from
  // the edge function. Both update the shared cache via setConnected().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const redirected = await handleOAuthRedirect();
        if (cancelled) return;
        if (!redirected) {
          await checkAuthStatus();
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to check Gmail status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    setError(null);
    try {
      await initGmailAuth();
      // initGmailAuth navigates away — this line is not normally reached
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Gmail auth');
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await clearAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect Gmail');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isAuthenticated: authenticated,
    email,
    login,
    logout,
    loading,
    error,
  };
}
