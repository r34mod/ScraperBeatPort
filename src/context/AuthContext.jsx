import { createContext, useContext, useState, useCallback } from 'react';

const KEY = 'msh_session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());

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

  return (
    <AuthContext.Provider value={{ session, token, email, userId, isLoggedIn, save, clear }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
