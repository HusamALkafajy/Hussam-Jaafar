'use client';

import React from 'react';
import { LocaleProvider } from '../hooks/use-locale';
import { AuthProvider } from '../hooks/use-auth';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>StudyAI — AI-Powered Learning Platform</title>
        <meta name="description" content="SaaS multi-tenant educational platform using Google Gemini API to summarize, explain and quiz students based on document uploads." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* OpenGraph / Facebook */}
        <meta property="og:title" content="StudyAI — Learn Smarter with AI" />
        <meta property="og:description" content="SaaS educational platform using Google Gemini API to summarize, explain, and quiz students based on document uploads." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://studyai.com" />
        <meta property="og:image" content="https://studyai.com/og-image.png" />
        <meta property="og:site_name" content="StudyAI" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="StudyAI — Learn Smarter with AI" />
        <meta name="twitter:description" content="SaaS educational platform using Google Gemini API to summarize, explain, and quiz students based on document uploads." />
        <meta name="twitter:image" content="https://studyai.com/og-image.png" />

        {/* Structured Schema Markup */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'EducationalOrganization',
              'name': 'StudyAI',
              'url': 'https://studyai.com',
              'logo': 'https://studyai.com/logo.png',
              'description': 'AI-Powered Educational Platform for summarization, explanations, quizzes, and spaced repetition flashcards.',
              'sameAs': [
                'https://twitter.com/studyai',
                'https://github.com/studyai',
              ],
            }),
          }}
        />
      </head>
      <body className="relative min-h-screen bg-[#0b0f19] text-slate-100 antialiased overflow-x-hidden" suppressHydrationWarning>
        {/* Animated Background Blur Orbs */}
        <div className="orb orb-primary" />
        <div className="orb orb-secondary" />
        <div className="orb orb-accent" />

        <LocaleProvider>
          <AuthProvider>
            <div className="relative z-10 flex flex-col min-h-screen">
              {children}
            </div>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
