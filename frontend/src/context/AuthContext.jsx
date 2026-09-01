import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    authApi.getProfile()
      .then((res) => {
        setUser(res.data);
        setPermissions(res.data.permissions || []);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setPermissions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    setPermissions(res.data.permissions || []);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions([]);
  };

  const refreshPermissions = async () => {
    if (!user) return;
    try {
      const res = await authApi.getProfile();
      setPermissions(res.data.permissions || []);
    } catch {
      // ignore
    }
  };

  /**
   * Check if current user has a specific permission
   * Main admin always has all permissions
   */
  const hasPermission = (tab, field) => {
    if (!user) return false;
    if (user.role === 'main_admin') return true;
    return permissions.some((p) => p.tab === tab && p.field === field && p.granted);
  };

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, hasPermission, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
