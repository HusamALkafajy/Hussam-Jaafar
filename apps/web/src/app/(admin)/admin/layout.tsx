'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/use-auth';
import { useLocale } from '../../../hooks/use-locale';
import { Spinner } from '../../../components/ui/spinner';
import { Button } from '../../../components/ui/button';
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  CreditCard,
  Cpu,
  LogOut,
  ChevronLeft,
  GraduationCap,
  Globe,
  ArrowLeft,
  User,
} from 'lucide-react';

export default function AdminLayout({
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
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'admin') {
        router.push('/files');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0b0f19]">
        <Spinner className="w-10 h-10 border-4 border-indigo-500" />
      </div>
    );
  }

  // Double check role boundary
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#060913] text-slate-100 p-6">
        <div className="max-w-md w-full glass border border-rose-500/20 p-8 rounded-2xl flex flex-col items-center text-center gap-6">
          <div className="p-4 bg-rose-500/10 rounded-full text-rose-500">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('admin.unauthorized')}</h1>
            <p className="text-slate-400 text-sm mt-2">
              {locale === 'ar' 
                ? 'عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى لوحة الإدارة.' 
                : 'Access denied. You must be an administrator to view this page.'}
            </p>
          </div>
          <Button
            nativeButton={false}
            render={<Link href="/files" />}
            variant="primary"
            className="w-full gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('admin.backToDashboard')}</span>
          </Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: locale === 'ar' ? 'نظرة عامة' : 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: t('admin.usersTab'), href: '/admin/users', icon: Users },
    { label: t('admin.paymentsTab'), href: '/admin/payments', icon: CreditCard },
    { label: t('admin.aiUsageTab'), href: '/admin/ai-usage', icon: Cpu },
  ];

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="min-h-screen w-full flex bg-[#060913] text-slate-100" dir={dir}>
      {/* Sidebar */}
      <aside
        className={`glass border-r border-slate-800/40 h-screen sticky top-0 flex flex-col justify-between transition-all duration-300 z-30 ${
          sidebarOpen ? 'w-66' : 'w-20'
        }`}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/20">
            <Link href="/admin" className="flex items-center gap-2 overflow-hidden">
              <div className="bg-red-500/20 border border-red-500/30 p-2 rounded-lg text-red-400">
                <GraduationCap className="w-5 h-5 shrink-0" />
              </div>
              {sidebarOpen && (
                <span className="text-md font-extrabold text-red-400 tracking-wider truncate">
                  STUDYAI ADMIN
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

          {/* Links */}
          <nav className="flex flex-col gap-1 p-3 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative cursor-pointer ${
                    isActive
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-md shadow-red-500/5'
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

            <div className="h-px bg-slate-800/30 my-4" />

            {/* Back to Student view */}
            <Link
              href="/files"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{t('admin.backToDashboard')}</span>}
            </Link>
          </nav>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/20 flex flex-col gap-2">
          {/* Language toggle inside sidebar */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 w-full cursor-pointer"
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
            <span>{locale === 'ar' ? 'مرحباً، مسؤول النظام' : 'Welcome Admin,'}</span>
            <span className="text-red-400 font-bold">{user.firstName}</span>
          </h3>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase select-none">
              ADMINISTRATOR
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 select-none uppercase font-bold text-sm">
              {user.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                `${user.firstName[0]}${user.lastName[0]}`
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
