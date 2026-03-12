import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const KEY = 'msh_session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());
  const refreshingRef = useRef(false);

  const save = useCallback((data) => {
    localStorage.setItem(KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  const token = session?.session?.access_token || null;
  const email = session?.user?.email || '';
  const userId = session?.user?.id || null;
  const isLoggedIn = !!token;

  // Returns true if the stored token is expired (or within 60 s of expiry)
  const isExpired = useCallback(() => {
    const expiresAt = session?.session?.expires_at;
    if (!expiresAt) return !token;
    return Date.now() / 1000 > expiresAt - 60;
  }, [session, token]);

  // Refresh the access_token using the stored refresh_token.
  // Returns the new token string on success, or null on failure (clears session).
  const refresh = useCallback(async () => {
    if (refreshingRef.current) return null;
    const refreshToken = session?.session?.refresh_token;
    if (!refreshToken) { clear(); return null; }
    refreshingRef.current = true;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) { clear(); return null; }
      const data = await res.json();
      if (data?.session?.access_token) {
        const updated = { ...session, session: data.session };
        save(updated);
        return data.session.access_token;
      }
      clear();
      return null;
    } catch {
      return null;
    } finally {
      refreshingRef.current = false;
    }
  }, [session, save, clear]);

  // Returns a valid token, refreshing first if the current one is nearly expired.
  const getValidToken = useCallback(async () => {
    if (!token) return null;
    if (isExpired()) return await refresh();
    return token;
  }, [token, isExpired, refresh]);

  // Auto-refresh on mount if the stored token is already expired
  useEffect(() => {
    if (session && isExpired()) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ session, token, email, userId, isLoggedIn, isExpired, refresh, getValidToken, save, clear }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
