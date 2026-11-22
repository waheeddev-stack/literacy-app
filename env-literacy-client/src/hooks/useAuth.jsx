import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get, post, tokens } from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokens.get());

  const logout = useCallback(() => { tokens.clear(); setUser(null); qc.clear(); }, [qc]);

  useEffect(() => {
    if (!tokens.get()) return;
    get('/auth/me').then(setUser).catch(() => tokens.clear()).finally(() => setLoading(false));
  }, []);
  useEffect(() => { window.addEventListener('elp:logout', logout); return () => window.removeEventListener('elp:logout', logout); }, [logout]);

  const login = useCallback(async (email, password) => {
    const d = await post('/auth/login', { email, password });
    tokens.set({ access: d.access_token, refresh: d.refresh_token });
    qc.clear();
    setUser(await get('/auth/me'));
    return d.user;
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const HOME = { student: '/', teacher: '/classes', inst_admin: '/institution', regional_admin: '/region', super_admin: '/region' };
