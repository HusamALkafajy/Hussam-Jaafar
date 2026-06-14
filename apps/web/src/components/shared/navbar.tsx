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
    <header className="sticky top-0 z-50 w-full glass backdrop-blur-md border-b border-slate-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="gradient-primary p-2 rounded-lg text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text">
            {t('common.appName')}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <Link href="#features" className="hover:text-white transition-colors">
            {t('landing.featuresTitle')}
          </Link>
          <Link href="#pricing" className="hover:text-white transition-colors">
            {t('landing.pricingTitle')}
          </Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-sm transition-all"
          >
            <Globe className="w-4 h-4" />
            <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {user ? (
            <>
              <Button href="/dashboard" size="sm">
                {t('dashboard.sidebarHome')}
              </Button>
              <Button size="sm" variant="ghost" onClick={logout}>
                {t('common.logout')}
              </Button>
            </>
          ) : (
            <>
              <Button href="/login" size="sm" variant="ghost">
                {t('common.login')}
              </Button>
              <Button href="/register" size="sm">
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
        <div className="md:hidden glass border-t border-slate-800/40 px-4 pt-4 pb-6 flex flex-col gap-4">
          <Link
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="text-slate-300 hover:text-white text-base py-2 border-b border-slate-800/20"
          >
            {t('landing.featuresTitle')}
          </Link>
          <Link
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="text-slate-300 hover:text-white text-base py-2 border-b border-slate-800/20"
          >
            {t('landing.pricingTitle')}
          </Link>

          <div className="flex flex-col gap-3 mt-2">
            <button
              onClick={() => {
                toggleLanguage();
                setMobileOpen(false);
              }}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-800 text-slate-300 text-sm hover:bg-slate-800"
            >
              <Globe className="w-4 h-4" />
              <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            {user ? (
              <>
                <Button href="/dashboard" className="w-full" onClick={() => setMobileOpen(false)}>
                  {t('dashboard.sidebarHome')}
                </Button>
                <Button className="w-full" variant="ghost" onClick={() => { logout(); setMobileOpen(false); }}>
                  {t('common.logout')}
                </Button>
              </>
            ) : (
              <>
                <Button href="/login" className="w-full" variant="ghost" onClick={() => setMobileOpen(false)}>
                  {t('common.login')}
                </Button>
                <Button href="/register" className="w-full" onClick={() => setMobileOpen(false)}>
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
