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
  Compass,
  Award,
  Trophy,
  MessageSquare,
  NotebookPen,
  Users,
  Search,
} from 'lucide-react';
import { GamificationWidget } from '../../components/gamification-widget';
import { GamificationCelebration } from '../../components/gamification-celebration';
import {
  PageLayout,
  PageLayoutHeader,
  PageLayoutSidebar,
  PageLayoutMain,
} from '../../components/ui/page-layout';
import {
  SidebarNav,
  SidebarNavGroup,
  SidebarNavItem,
} from '../../components/ui/sidebar-nav';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from '../../components/ui/breadcrumb';
import {
  TopNav,
  TopNavStart,
  TopNavCenter,
  TopNavEnd,
} from '../../components/ui/top-nav';
import { SearchField } from '../../components/ui/search-field';
import { GlobalCommandPalette } from '../../components/global-command-palette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale, dir } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Spinner className="w-10 h-10 border-4" />
      </div>
    );
  }

  if (!user) {
    return null; // Prevents flashing while redirecting
  }

  const navItems = [
    { label: t('dashboard.sidebarFiles') || 'Files', href: '/files', icon: FolderOpen },
    { label: 'Exams', href: '/exams', icon: GraduationCap },
    { label: 'Flashcards', href: '/flashcards', icon: MessageSquare },
  ];

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  return (
    <PageLayout variant="dashboard" dir={dir}>
      <GlobalCommandPalette />
      <GamificationCelebration />
      <PageLayoutSidebar className="justify-between">
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* Sidebar Header */}
          <div className="h-16 flex items-center px-4 border-b shrink-0">
            <Link href="/files" className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary p-2 rounded-lg">
                <GraduationCap className="w-5 h-5 shrink-0" />
              </div>
              <span className="text-lg font-bold truncate">
                {t('common.appName')}
              </span>
            </Link>
          </div>

          {/* Nav Items */}
          <div className="p-4 flex-1">
            <SidebarNav>
              <SidebarNavGroup>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <SidebarNavItem
                      key={item.href}
                      href={item.href}
                      active={isActive}
                      icon={<Icon />}
                    >
                      {item.label}
                    </SidebarNavItem>
                  );
                })}
              </SidebarNavGroup>
            </SidebarNav>
            <div className="mt-4">
              <GamificationWidget sidebarOpen={true} />
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t flex flex-col gap-2 shrink-0">
          <SidebarNav>
            <SidebarNavItem onClick={toggleLanguage} icon={<Globe />}>
              <span className="w-full text-start inline-block">
                {locale === 'ar' ? 'English' : 'العربية'}
              </span>
            </SidebarNavItem>
            <SidebarNavItem
              onClick={logout}
              icon={<LogOut />}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full text-start"
            >
              <span className="w-full text-start inline-block">
                {t('common.logout')}
              </span>
            </SidebarNavItem>
          </SidebarNav>
        </div>
      </PageLayoutSidebar>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PageLayoutHeader className="bg-background/95 backdrop-blur z-20">
          <TopNav className="border-0 px-0 h-full">
            <TopNavStart>
              <div className="hidden md:flex">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/files" className="text-foreground font-semibold">
                        {t('dashboard.welcome')}, {user.firstName}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </TopNavStart>

            <TopNavCenter>
              <div className="hidden md:flex w-full max-w-sm" onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                document.dispatchEvent(event);
              }}>
                <SearchField placeholder="Search workspace... (Cmd+K)" className="w-full bg-muted cursor-text" readOnly />
              </div>
            </TopNavCenter>

            <TopNavEnd>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Search className="w-5 h-5" />
                <span className="sr-only">Search</span>
              </Button>

              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase select-none">
                {user.subscriptionTier}
              </div>

              <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center text-muted-foreground select-none uppercase font-bold text-sm overflow-hidden">
                {user.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.firstName && user.lastName ? (
                    `${user.firstName[0]}${user.lastName[0]}`
                  ) : (
                    <User className="w-4 h-4" />
                  )
                )}
              </div>
            </TopNavEnd>
          </TopNav>
        </PageLayoutHeader>

        <PageLayoutMain>
          {children}
        </PageLayoutMain>
      </div>
    </PageLayout>
  );
}


