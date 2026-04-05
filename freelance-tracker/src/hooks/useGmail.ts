import { useState, useCallback, useEffect } from 'react';
import { initGmailAuth, handleOAuthRedirect, isAuthenticated as checkAuth, clearAuth } from '../lib/gmail';

export function useGmail() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    // Check if we're returning from an OAuth redirect
    const redirectHandled = handleOAuthRedirect();
    if (redirectHandled) return true;
    return checkAuth();
  });
  const [loading, setLoading] = useState(false);

  // Re-check on mount (token may have expired between renders)
  useEffect(() => {
    setAuthenticated(checkAuth());
  }, []);

  const login = useCallback(() => {
    // Must be synchronous to preserve user gesture for navigation
    initGmailAuth();
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
