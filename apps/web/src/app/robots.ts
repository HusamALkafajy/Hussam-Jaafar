import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studyai.com';

/**
 * Next.js Robots — auto-served at /robots.txt
 *
 * Strategy:
 *   - Allow all public marketing & auth pages.
 *   - Block all authenticated/dashboard routes from indexing (no SEO value
 *     and would expose user-specific URLs if shared/indexed).
 *   - Block the Next.js internals and API routes.
 *   - Reference the sitemap so crawlers can discover public pages efficiently.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Default rule for all bots
        userAgent: '*',
        allow: [
          '/',
          '/login',
          '/register',
          '/forgot-password',
          '/privacy',
          '/terms',
          '/og-image.png',
          '/logo.png',
        ],
        disallow: [
          // Authenticated dashboard routes
          '/dashboard/',
          '/files/',
          '/exams/',
          '/flashcards/',
          '/analytics/',
          '/settings/',
          '/subscription/',
          '/admin/',
          '/chat/',
          '/notes/',
          '/study-groups/',
          '/learning-paths/',
          '/certifications/',
          '/recommendations/',
          // Next.js internals
          '/_next/',
          '/api/',
          '/verify/',
        ],
      },
      {
        // AI training crawlers — disallow everything
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Google-Extended',
          'CCBot',
          'anthropic-ai',
          'Claude-Web',
          'Omgilibot',
          'FacebookBot',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
