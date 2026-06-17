import React from 'react';
import { cookies, headers } from 'next/headers';
import type { Metadata } from 'next';
import { LocaleProvider } from '../hooks/use-locale';
import { AuthProvider } from '../hooks/use-auth';
import './globals.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Locale = 'ar' | 'en';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studyai.com';

// ─── Server-Side Locale Resolution ───────────────────────────────────────────

/**
 * Resolve the locale for the current request from (in priority order):
 *   1. The `locale` cookie (set by Edge Middleware or the user's language toggle)
 *   2. The `x-locale` request header forwarded by the middleware
 *   3. The `Accept-Language` header as a last resort
 *
 * This runs in the React Server Component (RSC) context, which means:
 *   - It executes on the server for every request (never cached across users)
 *   - The returned value is baked into the initial HTML so the browser paints
 *     with the correct `dir` / `lang` — no client-side layout shift.
 */
async function resolveServerLocale(): Promise<Locale> {
  // 1. Cookie (most authoritative — persists user preference across visits)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  if (cookieLocale === 'ar' || cookieLocale === 'en') return cookieLocale;

  // 2. x-locale header forwarded by middleware
  const headerStore = await headers();
  const xLocale = headerStore.get('x-locale');
  if (xLocale === 'ar' || xLocale === 'en') return xLocale;

  // 3. Accept-Language header as a final fallback
  const acceptLanguage = headerStore.get('accept-language') || '';
  const primaryLang = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? '';
  if (primaryLang.startsWith('en')) return 'en';

  // Default: Arabic (Middle-East target market)
  return 'ar';
}

// ─── Dynamic SEO Metadata ─────────────────────────────────────────────────────

/**
 * `generateMetadata` runs as a Server Component — it can safely call
 * `cookies()` and `headers()` to resolve the locale and serve locale-aware
 * titles/descriptions to search crawlers without client-side JS.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const isAr = locale === 'ar';

  const title = isAr
    ? 'StudyAI — منصة التعلم الذكي بالذكاء الاصطناعي'
    : 'StudyAI — AI-Powered Learning Platform';

  const description = isAr
    ? 'ارفع ملفاتك الدراسية واحصل فوراً على ملخصات ذكية، شروحات تفاعلية، اختبارات مخصصة، وبطاقات تعليمية بتقنية الذكاء الاصطناعي.'
    : 'Upload your study materials and get instant AI-powered summaries, explanations, custom quizzes, and spaced-repetition flashcards.';

  const ogImageUrl = `${SITE_URL}/og-image.png`;

  return {
    // ── Core ──────────────────────────────────────────────────────────────
    title: {
      default: title,
      template: `%s | StudyAI`,
    },
    description,
    metadataBase: new URL(SITE_URL),

    // ── OpenGraph ─────────────────────────────────────────────────────────
    openGraph: {
      type: 'website',
      siteName: 'StudyAI',
      title,
      description,
      url: SITE_URL,
      locale: isAr ? 'ar_SA' : 'en_US',
      alternateLocale: isAr ? 'en_US' : 'ar_SA',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },

    // ── Twitter / X ───────────────────────────────────────────────────────
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
      site: '@studyai',
    },

    // ── Crawling & Canonical ──────────────────────────────────────────────
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // ── Alternate language links (hreflang) ───────────────────────────────
    alternates: {
      canonical: SITE_URL,
      languages: {
        'en': `${SITE_URL}`,
        'ar': `${SITE_URL}`,
      },
    },

    // ── App metadata ──────────────────────────────────────────────────────
    applicationName: 'StudyAI',
    keywords: isAr
      ? ['ذكاء اصطناعي', 'تعلم', 'ملخصات', 'اختبارات', 'بطاقات تعليمية', 'StudyAI']
      : ['AI learning', 'study assistant', 'summaries', 'quizzes', 'flashcards', 'StudyAI'],
    authors: [{ name: 'StudyAI Team' }],
    category: 'education',
  };
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

/**
 * RootLayout — React Server Component.
 *
 * Key design decisions:
 *
 * 1. `lang` and `dir` are set server-side from the locale cookie / header.
 *    The browser receives the correct HTML before executing any JavaScript,
 *    so Arabic users never see the page flicker from LTR → RTL.
 *
 * 2. The resolved `locale` is passed as `initialLocale` to `<LocaleProvider>`.
 *    This means the provider's initial state matches the server render exactly,
 *    which satisfies React's hydration constraint (client tree === server tree).
 *    Only *after* hydration does the provider check localStorage/cookie for any
 *    override the user may have set in a previous session.
 *
 * 3. `suppressHydrationWarning` is kept on `<html>` and `<body>` to silence
 *    the harmless warning that arises from browser extensions injecting
 *    attributes (e.g. Google Translate, password managers).
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveServerLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Structured Data — EducationalOrganization schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'EducationalOrganization',
              name: 'StudyAI',
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
              description:
                'AI-Powered Educational Platform for summarisation, explanations, quizzes, and spaced-repetition flashcards.',
              sameAs: [
                'https://twitter.com/studyai',
                'https://github.com/studyai',
              ],
            }),
          }}
        />
      </head>
      <body
        className="relative min-h-screen bg-[#0b0f19] text-slate-100 antialiased overflow-x-hidden"
        suppressHydrationWarning
      >
        {/* Animated Background Blur Orbs */}
        <div className="orb orb-primary" />
        <div className="orb orb-secondary" />
        <div className="orb orb-accent" />

        {/*
         * Pass `initialLocale` so the first client render uses the same locale
         * the server used, preventing any hydration mismatch.
         */}
        <LocaleProvider initialLocale={locale}>
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
