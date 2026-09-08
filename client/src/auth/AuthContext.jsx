import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { login as loginRequest } from '../api/auth';
import { clearSession, getStoredUser, getToken, setUnauthorizedHandler, storeSession } from '../api/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  useMemo(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password);
    storeSession(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
