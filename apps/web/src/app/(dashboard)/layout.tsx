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
  SidebarNavButton,
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
import { GlobalCommandPalette } from '../../components/global-command-palette';
import { Toaster } from '../../components/ui/sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../components/ui/sheet';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale, dir } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    { label: t('dashboard.sidebarFiles'), href: '/files', icon: FolderOpen },
    { label: t('dashboard.sidebarExams'), href: '/exams', icon: GraduationCap },
    { label: t('dashboard.sidebarFlashcards'), href: '/flashcards', icon: MessageSquare },
  ];

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  const openCommandPalette = () => {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    window.setTimeout(() => document.dispatchEvent(event), 0);
  };

  const isFileDetailRoute = pathname !== '/files' && pathname.startsWith('/files/');

  return (
    <PageLayout
      variant="dashboard"
      dir={dir}
      className={isFileDetailRoute ? undefined : 'studyai-dashboard-theme'}
    >
      <GlobalCommandPalette />
      <Toaster richColors position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} />
      <GamificationCelebration />
      <PageLayoutSidebar className="justify-between border-sidebar-border bg-sidebar text-sidebar-foreground">
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
                      className={isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground [&_svg]:text-sidebar-primary' : undefined}
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
            <SidebarNavButton onClick={toggleLanguage} icon={<Globe />}>
              <span className="w-full text-start inline-block">
                {t(locale === 'ar' ? 'common.english' : 'common.arabic')}
              </span>
            </SidebarNavButton>
            <SidebarNavButton
              onClick={logout}
              icon={<LogOut />}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full text-start"
            >
              <span className="w-full text-start inline-block">
                {t('common.logout')}
              </span>
            </SidebarNavButton>
          </SidebarNav>
        </div>
      </PageLayoutSidebar>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PageLayoutHeader className="z-20 border-border bg-secondary/95 backdrop-blur">
          <TopNav className="h-full border-0 bg-transparent px-0">
            <TopNavStart>
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      aria-label={t('dashboard.sidebarHome')}
                    />
                  }
                >
                  <Menu className="w-5 h-5 text-muted-foreground" />
                  <span className="sr-only">{t('dashboard.sidebarHome')}</span>
                </SheetTrigger>

                <SheetContent
                  side={dir === 'rtl' ? 'right' : 'left'}
                  className="studyai-dashboard-theme w-80 max-w-[85vw] gap-0 border-border bg-secondary p-0 text-foreground md:hidden"
                >
                  <SheetHeader className="h-16 flex-row items-center border-b px-4 py-0 pe-14">
                    <Link
                      href="/files"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-2"
                    >
                      <div className="bg-primary/10 text-primary p-2 rounded-lg">
                        <GraduationCap className="w-5 h-5 shrink-0" />
                      </div>
                      <SheetTitle className="text-lg font-bold">
                        {t('common.appName')}
                      </SheetTitle>
                    </Link>
                    <SheetDescription className="sr-only">
                      {t('dashboard.sidebarHome')}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
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
                              className={isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground [&_svg]:text-sidebar-primary' : undefined}
                              onClick={(event) => {
                                event.preventDefault();
                                setMobileNavOpen(false);
                                router.push(item.href);
                              }}
                            >
                              {item.label}
                            </SidebarNavItem>
                          );
                        })}
                      </SidebarNavGroup>
                    </SidebarNav>
                  </div>

                  <SheetFooter className="border-t">
                    <SidebarNav>
                      <SidebarNavButton
                        onClick={() => {
                          toggleLanguage();
                          setMobileNavOpen(false);
                        }}
                        icon={<Globe />}
                      >
                        <span className="w-full text-start inline-block">
                          {t(locale === 'ar' ? 'common.english' : 'common.arabic')}
                        </span>
                      </SidebarNavButton>
                      <SidebarNavButton
                        onClick={() => {
                          setMobileNavOpen(false);
                          void logout();
                        }}
                        icon={<LogOut />}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full text-start"
                      >
                        <span className="w-full text-start inline-block">
                          {t('common.logout')}
                        </span>
                      </SidebarNavButton>
                    </SidebarNav>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <div className="hidden md:flex">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/files" className="text-foreground font-semibold">
                        {t('dashboard.welcome')} {user.firstName}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </TopNavStart>

            <TopNavCenter>
              <div className="hidden md:flex w-full max-w-sm">
                <Button
                  variant="outline"
                  className="w-full justify-start bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={openCommandPalette}
                >
                  <Search className="size-4" />
                  <span className="truncate">{t('dashboard.searchWorkspace')}</span>
                </Button>
              </div>
            </TopNavCenter>

            <TopNavEnd>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={openCommandPalette}
              >
                <Search className="w-5 h-5 text-muted-foreground" />
                <span className="sr-only">{t('common.search')}</span>
              </Button>

              <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center text-muted-foreground select-none uppercase font-bold text-sm overflow-hidden">
                {user.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={user.avatarUrl} alt={t('common.avatar')} className="w-full h-full object-cover" />
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


