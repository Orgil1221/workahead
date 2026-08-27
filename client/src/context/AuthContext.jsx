import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wa_user')); } catch { return null; }
  });

  const login = (token, u) => {
    if (token) localStorage.setItem('wa_token', token);
    localStorage.setItem('wa_user', JSON.stringify(u));
    setUser(u);
  };
  const updateUser = (u) => {
    localStorage.setItem('wa_user', JSON.stringify(u));
    setUser(u);
  };
  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': localStorage.getItem('wa_csrf') || '' } }); } catch {}
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
