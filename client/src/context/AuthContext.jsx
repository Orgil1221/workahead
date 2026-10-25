import { createContext, useContext, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  try { localStorage.removeItem('wa_token'); } catch {}
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wa_user')); } catch { return null; }
  });

  const login = (u) => {
    localStorage.setItem('wa_user', JSON.stringify(u));
    setUser(u);
  };
  const updateUser = (u) => {
    localStorage.setItem('wa_user', JSON.stringify(u));
    setUser(u);
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('wa_token');
    localStorage.removeItem('wa_user');
    setUser(null);
    // Force reload to clear csrf cache
    try { localStorage.removeItem('wa_csrf'); } catch {}
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
