'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from '../../hooks/use-locale';
import { useAuth } from '../../hooks/use-auth';
import { Button } from '../ui/button';
import { Globe, Menu, X, BookOpen } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { t, locale, setLocale, dir } = useLocale();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="sticky top-0 z-50 w-full glass backdrop-blur-md border-b border-border/70">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="gradient-primary p-2 rounded-lg text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text">
            {t('common.appName')}
          </span>
        </Link>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-sm transition-all"
          >
            <Globe className="w-4 h-4" />
            <span>{t(locale === 'ar' ? 'common.english' : 'common.arabic')}</span>
          </button>

          {user ? (
            <>
              <Button nativeButton={false} render={<Link href="/files" />} size="sm">
                {t('dashboard.sidebarHome')}
              </Button>
              <Button size="sm" variant="ghost" onClick={logout}>
                {t('common.logout')}
              </Button>
            </>
          ) : (
            <>
              <Button nativeButton={false} render={<Link href="/login" />} size="sm" variant="ghost">
                {t('common.login')}
              </Button>
              <Button nativeButton={false} render={<Link href="/register" />} size="sm">
                {t('common.register')}
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition-all"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-slate-800/40 px-4 pt-3 pb-5 flex flex-col gap-3">
          <Link
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="w-full rounded-lg px-3 py-2.5 text-right text-base font-medium text-slate-200 transition-colors hover:bg-slate-800/50 hover:text-white"
          >
            {t('landing.featuresTitle')}
          </Link>

          <div className="mt-1 flex flex-col gap-2 border-t border-border/60 pt-3">
            <Button
              variant="secondary"
              className="h-10 w-full flex items-center justify-center gap-2"
              onClick={() => {
                toggleLanguage();
                setMobileOpen(false);
              }}
            >
              <Globe className="w-4 h-4" />
              <span>{t(locale === 'ar' ? 'common.english' : 'common.arabic')}</span>
            </Button>

            {user ? (
              <>
                <Button nativeButton={false} render={<Link href="/files" />} className="h-10 w-full" onClick={() => setMobileOpen(false)}>
                  {t('dashboard.sidebarHome')}
                </Button>
                <Button className="h-10 w-full" variant="secondary" onClick={() => { logout(); setMobileOpen(false); }}>
                  {t('common.logout')}
                </Button>
              </>
            ) : (
              <>
                <Button nativeButton={false} render={<Link href="/login" />} className="h-10 w-full" variant="secondary" onClick={() => setMobileOpen(false)}>
                  {t('common.login')}
                </Button>
                <Button nativeButton={false} render={<Link href="/register" />} className="h-10 w-full" variant="default" onClick={() => setMobileOpen(false)}>
                  {t('common.register')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
