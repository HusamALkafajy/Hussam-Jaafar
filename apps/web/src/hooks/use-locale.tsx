'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ar from '../i18n/ar.json';
import en from '../i18n/en.json';

type Locale = 'ar' | 'en';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
  dir: 'rtl' | 'ltr';
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const translations: Record<Locale, any> = { ar, en };

/**
 * Reads the `locale` cookie from `document.cookie`.
 * Returns undefined when running in SSR or when the cookie is absent.
 */
function readLocaleCookie(): Locale | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|; )locale=([^;]+)/);
  const raw = match?.[1];
  return raw === 'ar' || raw === 'en' ? raw : undefined;
}

/**
 * LocaleProvider
 *
 * `initialLocale` is resolved server-side (from the `locale` cookie via
 * `next/headers`) and passed in by RootLayout so that the initial server
 * render and the first client render are in full agreement — eliminating
 * the hydration mismatch and RTL flicker.
 *
 * After mount, the provider can still be updated by the user clicking a
 * language toggle; changes are persisted to localStorage and the cookie.
 */
export const LocaleProvider: React.FC<{
  children: React.ReactNode;
  initialLocale?: Locale;
}> = ({ children, initialLocale = 'ar' }) => {
  /**
   * IMPORTANT: useState must be initialised with `initialLocale` (not a
   * lazy function that reads from localStorage) so that the SSR output and
   * the React hydration pass produce the exact same tree.
   *
   * We synchronise with localStorage only after hydration, inside a
   * useEffect, which runs exclusively on the client.
   */
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    /**
     * After hydration is complete, check both the cookie (authoritative,
     * written by middleware and the setLocale function) and localStorage
     * (legacy). Cookie wins if present because it is also what middleware
     * uses — keeping all layers in sync.
     */
    const cookieLocale = readLocaleCookie();
    const lsLocale = (() => {
      try {
        const saved = localStorage.getItem('locale');
        return saved === 'ar' || saved === 'en' ? (saved as Locale) : undefined;
      } catch {
        return undefined;
      }
    })();

    const resolved = cookieLocale ?? lsLocale ?? initialLocale;
    if (resolved !== locale) {
      setLocaleState(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once after first paint

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);

    // Persist to localStorage (legacy reads)
    try {
      localStorage.setItem('locale', newLocale);
    } catch {
      /* ignore in SSR / private-mode */
    }

    // Write the cookie so middleware + next RSC layout read the correct value
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Update the <html> attributes immediately for the current navigation
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr';

  /**
   * Sync <html> attrs whenever locale changes client-side.
   * (The server already sets them on initial load via RootLayout.)
   */
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const t = useCallback(
    (path: string): string => {
      const keys = path.split('.');
      let result: any = translations[locale];
      for (const key of keys) {
        if (result && key in result) {
          result = result[key];
        } else {
          return path; // Graceful fallback: return key path
        }
      }
      return typeof result === 'string' ? result : path;
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
