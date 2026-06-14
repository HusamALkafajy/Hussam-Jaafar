"use client";

// NOTE: This hook relies on httpOnly cookies set by the server for auth (`access_token`, `refresh_token`).
// Do NOT attempt to read auth cookies from `document.cookie`; they are intentionally httpOnly.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { UserProfileResponse, RegisterDto } from '@studyai/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: UserProfileResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkSession = async () => {
    try {
      const data = await api.get<{ user: UserProfileResponse }>('/auth/me');
      setUser(data.user);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getCsrfToken = (): string | undefined => {
    try {
      const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
      return match ? decodeURIComponent(match[1]) : undefined;
    } catch (e) {
      return undefined;
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const csrf = getCsrfToken();
      const data = await api.post<{ user: UserProfileResponse }>('/auth/login', { email, password }, csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined);
      setUser(data.user);
      router.push('/dashboard');
    } catch (e: any) {
      setUser(null);
      throw new Error(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (registerData: any) => {
    setLoading(true);
    try {
      const csrf = getCsrfToken();
      const data = await api.post<{ user: UserProfileResponse }>('/auth/register', registerData, csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined);
      setUser(data.user);
      router.push('/dashboard');
    } catch (e: any) {
      setUser(null);
      throw new Error(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const csrf = getCsrfToken();
      await api.post('/auth/logout', undefined, csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined);
    } catch (e) {
      console.warn('Logout API failed, clearing local state', e);
    } finally {
      setUser(null);
      setLoading(false);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
