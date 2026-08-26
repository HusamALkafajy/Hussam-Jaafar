import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reader | StudyAI',
  description: 'Immersive reading environment',
};

export default function ReaderRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Reader layout completely removes the global shell/navigation
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
