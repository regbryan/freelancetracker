import { useState, useCallback, useEffect } from 'react';
import { initGmailAuth, isAuthenticated as checkAuth, clearAuth } from '../lib/gmail';

export function useGmail() {
  const [authenticated, setAuthenticated] = useState<boolean>(checkAuth());
  const [loading, setLoading] = useState(false);

  // Re-check on mount (token may have expired between renders)
  useEffect(() => {
    setAuthenticated(checkAuth());
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    try {
      await initGmailAuth();
      setAuthenticated(true);
    } catch (error) {
      console.error('Gmail auth failed:', error);
      setAuthenticated(false);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuthenticated(false);
  }, []);

  return {
    isAuthenticated: authenticated,
    login,
    logout,
    loading,
  };
}
