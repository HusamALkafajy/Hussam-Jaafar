'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('ar'); // Default to Arabic for Middle East focus

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved === 'ar' || saved === 'en') {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [locale, dir]);

  const t = (path: string): string => {
    const keys = path.split('.');
    let result = translations[locale];

    for (const key of keys) {
      if (result && key in result) {
        result = result[key];
      } else {
        return path; // Fallback to path if key not found
      }
    }

    return typeof result === 'string' ? result : path;
  };

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
