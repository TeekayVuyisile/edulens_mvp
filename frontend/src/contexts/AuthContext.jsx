import { useCallback, useEffect, useMemo, useState } from 'react';
import http, { errorMessage, setUnauthorizedHandler, tokenStore } from '../lib/http';
import { AuthContext } from './useAuth';
import FullPageLoader from '../components/ui/FullPageLoader';

/**
 * Session state for the whole app.
 *
 * status: 'loading' while a stored token is being checked, then 'ready'.
 * user:   the signed-in user, or null.
 * notice: why the user was signed out (expired session, server unreachable),
 *         shown once on the login page.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'ready'));
  const [notice, setNotice] = useState(null);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Any API call answered with 401 ends the session.
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      if (!tokenStore.get()) return;
      clearSession();
      setNotice(message || 'Your session has expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokenStore.get()) return undefined;

    let cancelled = false;
    http
      .get('/api/auth/profile')
      .then((res) => {
        if (!cancelled) setUser(res.data.data.user);
      })
      .catch((error) => {
        // 401s are handled by the interceptor above; anything else means the
        // server couldn't be reached, so keep the token for the next attempt.
        if (!cancelled && !error.response) setNotice(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const res = await http.post('/api/auth/login', { email, password });
      const { token, user: signedIn } = res.data.data;
      tokenStore.set(token);
      setUser(signedIn);
      setNotice(null);
      return { ok: true, user: signedIn };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'Sign in failed. Please try again.') };
    }
  }, []);

  // One-click sign-in to a demo account (only offered when the server allows it).
  const demoLogin = useCallback(async (account) => {
    try {
      const res = await http.post('/api/auth/demo-login', { account });
      const { token, user: signedIn } = res.data.data;
      tokenStore.set(token);
      setUser(signedIn);
      setNotice(null);
      return { ok: true, user: signedIn };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'Couldn’t open the demo. Please try again.') };
    }
  }, []);

  const logout = useCallback(() => {
    // Fire and forget: signing out locally must never wait on the network.
    if (tokenStore.get()) http.post('/api/auth/logout').catch(() => {});
    clearSession();
    setNotice(null);
  }, [clearSession]);

  const forgotPassword = useCallback(async (email) => {
    try {
      const res = await http.post('/api/auth/forgot-password', { email });
      return { ok: true, message: res.data.message };
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    try {
      const res = await http.post('/api/auth/reset-password', { token, password });
      return { ok: true, message: res.data.message };
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    const res = await http.put('/api/auth/profile', data);
    setUser((current) => ({ ...current, ...res.data.data.user }));
    return res;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      notice,
      isAuthenticated: Boolean(user),
      login,
      demoLogin,
      logout,
      forgotPassword,
      resetPassword,
      updateProfile,
      dismissNotice: () => setNotice(null),
    }),
    [user, status, notice, login, demoLogin, logout, forgotPassword, resetPassword, updateProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {status === 'loading' ? <FullPageLoader label="Restoring your session…" /> : children}
    </AuthContext.Provider>
  );
};
