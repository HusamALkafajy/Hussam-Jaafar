"use client";

// NOTE: This hook relies on httpOnly cookies set by the server for auth (`access_token`, `refresh_token`).
// Do NOT attempt to read auth cookies from `document.cookie`; they are intentionally httpOnly.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { UserProfileResponse, RegisterDto } from '@studyai/types';
import { useRouter, useSearchParams } from 'next/navigation';

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

  // Read optional ?plan= query param to auto-trigger checkout after registration/login
  let searchParams: ReturnType<typeof useSearchParams> | null = null;
  try {
    // useSearchParams requires Suspense boundary; wrap in try/catch for RSC safety
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch {
    searchParams = null;
  }

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

  /**
   * After a successful login or registration, check if there is a ?plan= query param.
   * If so, immediately call the checkout API and redirect to Stripe — this creates the
   * seamless "click Pro on marketing page → register → land on Stripe checkout" flow.
   */
  const handlePostAuthRedirect = async (plan: string | null) => {
    if (plan && (plan === 'pro' || plan === 'institution')) {
      try {
        const data = await api.post<{ checkoutUrl: string }>('/subscriptions/checkout', { plan });
        window.location.href = data.checkoutUrl;
      } catch (e) {
        // Checkout auto-trigger failed — fall back to the subscription page
        console.warn('Auto-checkout failed after auth, redirecting to subscription page:', e);
        router.push('/subscription');
      }
    } else {
      router.push('/dashboard');
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const csrf = getCsrfToken();
      const data = await api.post<{ user: UserProfileResponse }>(
        '/auth/login',
        { email, password },
        csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined,
      );
      setUser(data.user);
      const plan = searchParams?.get('plan') ?? null;
      await handlePostAuthRedirect(plan);
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
      const data = await api.post<{ user: UserProfileResponse }>(
        '/auth/register',
        registerData,
        csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined,
      );
      setUser(data.user);
      // Check if this registration was initiated from the Pricing page with a plan param
      const plan = searchParams?.get('plan') ?? null;
      await handlePostAuthRedirect(plan);
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
