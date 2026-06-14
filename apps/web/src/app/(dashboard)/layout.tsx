'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { useLocale } from '../../hooks/use-locale';
import { Spinner } from '../../components/ui/spinner';
import { Button } from '../../components/ui/button';
import {
  LayoutDashboard,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  BarChart2,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  ChevronLeft,
  User,
  Globe,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale, dir } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0b0f19]">
        <Spinner className="w-10 h-10 border-4" />
      </div>
    );
  }

  if (!user) {
    return null; // Prevents flashing while redirecting
  }

  const navItems: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
  }> = [
    { label: t('dashboard.sidebarHome'), href: '/dashboard', icon: LayoutDashboard },
    { label: t('dashboard.sidebarFiles'), href: '/files', icon: FolderOpen },
    { label: t('dashboard.sidebarExams'), href: '/exams', icon: GraduationCap },
    { label: t('dashboard.sidebarFlashcards'), href: '/flashcards', icon: HelpCircle },
    { label: t('dashboard.sidebarAnalytics'), href: '/analytics', icon: BarChart2 },
    { label: t('dashboard.sidebarSettings'), href: '/settings', icon: Settings },
    { label: t('dashboard.sidebarSubscription'), href: '/subscription', icon: CreditCard },
  ];

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="min-h-screen w-full flex bg-[#060913] text-slate-100" dir={dir}>
      {/* Sidebar */}
      <aside
        className={`glass border-r border-slate-800/40 h-screen sticky top-0 flex flex-col justify-between transition-all duration-300 z-30 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex flex-col">
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/20">
            <Link href="/" className="flex items-center gap-2 overflow-hidden">
              <div className="gradient-primary p-2 rounded-lg text-white">
                <GraduationCap className="w-5 h-5 shrink-0" />
              </div>
              {sidebarOpen && (
                <span className="text-lg font-bold gradient-text truncate">
                  {t('common.appName')}
                </span>
              )}
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded hover:bg-slate-800/50 text-slate-400 hover:text-white"
            >
              <ChevronLeft className={`w-5 h-5 transition-transform duration-200 ${!sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-1 p-3 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                    item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isActive
                      ? 'gradient-primary text-white shadow-md shadow-indigo-500/10'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                  {!sidebarOpen && (
                    <span className="absolute left-22 scale-0 group-hover:scale-100 bg-slate-900 border border-slate-800 text-slate-100 text-xs px-2 py-1 rounded shadow-lg transition-all z-40 whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/20 flex flex-col gap-2">
          {/* Language toggle inside sidebar */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 w-full"
          >
            <Globe className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>{locale === 'ar' ? 'English' : 'العربية'}</span>}
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 w-full cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 glass border-b border-slate-800/40 flex items-center justify-between px-6 sticky top-0 z-20 backdrop-blur">
          <h3 className="text-base font-semibold text-slate-300 flex items-center gap-2">
            <span>{t('dashboard.welcome')}</span>
            <span className="text-white font-bold">{user.firstName}</span>
          </h3>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase select-none">
              {user.subscriptionTier}
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 select-none uppercase font-bold text-sm">
              {user.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                user.firstName && user.lastName ? (
                  `${user.firstName[0]}${user.lastName[0]}`
                ) : (
                  <User className="w-4 h-4" />
                )
              )}
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-grow p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
