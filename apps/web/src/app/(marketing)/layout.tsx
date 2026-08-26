'use client';

import React from 'react';
import { Navbar } from '../../components/shared/navbar';
import { Footer } from '../../components/marketing/Footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="studyai-marketing-theme flex min-h-screen flex-col bg-background/90 text-foreground">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
