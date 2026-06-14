'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../hooks/use-locale';
import { BookOpen } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-[#0b0f19]">
      <div className="absolute w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl top-1/4 left-1/4 animate-pulse" />
      <div className="absolute w-80 h-80 bg-purple-500/10 rounded-full blur-3xl bottom-1/4 right-1/4 animate-pulse" />

      {/* Brand logo at top */}
      <Link href="/" className="flex items-center gap-2 mb-8 z-10 group">
        <div className="gradient-primary p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/15 group-hover:scale-105 transition-transform duration-200">
          <BookOpen className="w-6 h-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight gradient-text">
          {t('common.appName')}
        </span>
      </Link>

      <div className="w-full max-w-md z-10">
        {children}
      </div>
    </div>
  );
}
