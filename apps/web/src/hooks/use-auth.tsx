'use client';

// NOTE: This hook relies on the httpOnly refresh_token cookie for session restoration.
// The access token lives ONLY in the browser JS heap (api-client.ts module scope).
// Do NOT attempt to read auth cookies from document.cookie; they are intentionally httpOnly.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { api, setAccessToken, onAuthExpired } from '../lib/api-client';
import { UserProfileResponse, RegisterDto } from '@studyai/types';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Context Type ─────────────────────────────────────────────────────────────

interface AuthContextType {
  user: UserProfileResponse | null;
  /** true while initial refresh or an auth action is in flight */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  // Starts true: protected routes must NOT redirect until refresh resolves
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Generation counter: incremented on logout/new login.
  // refreshSession captures the generation at call time and skips setState
  // if the generation has advanced (stale result from a previous auth lifecycle).
  const generationRef = useRef(0);

  // Ensures initial refresh fires exactly once per mount (StrictMode safe)
  const initializedRef = useRef(false);

  // Read optional ?plan= query param
  let searchParams: ReturnType<typeof useSearchParams> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch {
    searchParams = null;
  }

  // ── checkSession (used externally, e.g. settings page) ──────────────────
  const checkSession = useCallback(async () => {
    try {
      const data = await api.get<{ user: UserProfileResponse }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial page-load session restoration via /auth/refresh ─────────────
  const refreshSession = useCallback(async () => {
    const myGeneration = generationRef.current;
    try {
      const data = await api.post<{ user: UserProfileResponse; accessToken: string }>(
        '/auth/refresh',
      );
      if (generationRef.current !== myGeneration) return; // stale — discard
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch {
      if (generationRef.current !== myGeneration) return; // stale — discard
      setAccessToken(undefined);
      setUser(null);
    } finally {
      if (generationRef.current === myGeneration) {
        setLoading(false);
      }
    }
  }, []);

  // ── Mount: fire refresh once ─────────────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      refreshSession();
    }
  }, [refreshSession]);

  // ── Subscribe to 401-recovery auth expiry from api-client ───────────────
  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      generationRef.current += 1;
      setAccessToken(undefined);
      setUser(null);
      setLoading(false);
      router.push('/login');
    });
    return unsubscribe;
  }, [router]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCsrfToken = (): string | undefined => {
    try {
      const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
      return match ? decodeURIComponent(match[1]) : undefined;
    } catch {
      return undefined;
    }
  };

  const handlePostAuthRedirect = async (_plan: string | null) => {
    // FREE_LAUNCH_MODE: checkout is disabled — always go to dashboard.
    // TODO: Re-enable when STRIPE_ENABLED=true:
    // if (plan && (plan === 'pro' || plan === 'institution')) {
    //   const { checkoutUrl } = await api.post<{ checkoutUrl: string }>('/subscriptions/checkout', { plan });
    //   window.location.href = checkoutUrl;
    // }
    router.push('/dashboard');
  };

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    setLoading(true);
    const myGeneration = (generationRef.current += 1);
    try {
      const csrf = getCsrfToken();
      const data = await api.post<{ user: UserProfileResponse; accessToken: string }>(
        '/auth/login',
        { email, password },
        csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined,
      );
      if (generationRef.current !== myGeneration) return;
      setAccessToken(data.accessToken);
      setUser(data.user);
      const plan = searchParams?.get('plan') ?? null;
      await handlePostAuthRedirect(plan);
    } catch (e: any) {
      if (generationRef.current === myGeneration) setUser(null);
      throw new Error(e.message || 'Login failed');
    } finally {
      if (generationRef.current === myGeneration) setLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────────────────────

  const register = async (registerData: any) => {
    setLoading(true);
    const myGeneration = (generationRef.current += 1);
    try {
      const csrf = getCsrfToken();
      const data = await api.post<{ user: UserProfileResponse; accessToken: string }>(
        '/auth/register',
        registerData,
        csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined,
      );
      if (generationRef.current !== myGeneration) return;
      setAccessToken(data.accessToken);
      setUser(data.user);
      const plan = searchParams?.get('plan') ?? null;
      await handlePostAuthRedirect(plan);
    } catch (e: any) {
      if (generationRef.current === myGeneration) setUser(null);
      throw new Error(e.message || 'Registration failed');
    } finally {
      if (generationRef.current === myGeneration) setLoading(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = async () => {
    // Advance generation immediately so any in-flight refresh result is discarded
    generationRef.current += 1;
    setLoading(true);
    try {
      const csrf = getCsrfToken();
      await api.post(
        '/auth/logout',
        undefined,
        csrf ? { headers: { 'X-CSRF-Token': csrf } } : undefined,
      );
    } catch (e) {
      console.warn('Logout API failed, clearing local state', e);
    } finally {
      setAccessToken(undefined);
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
