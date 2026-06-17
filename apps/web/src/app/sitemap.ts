import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studyai.com';

/**
 * Next.js Sitemap — auto-served at /sitemap.xml
 *
 * Sections:
 *   1. Core public routes  (priority 1.0 → 0.9)
 *   2. Auth routes         (priority 0.7 — indexable but lower value)
 *   3. Static legal/info   (priority 0.5)
 *
 * Private/authenticated routes (dashboard, admin, settings…) are intentionally
 * excluded here and blocked in robots.ts via the Disallow list.
 *
 * `changeFrequency` values follow Google's guidance:
 *   - Homepage: 'daily'   (marketing copy & pricing change frequently)
 *   - Auth pages: 'monthly' (rarely change)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── 1. Core public pages ──────────────────────────────────────────────────
  const publicPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/#pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/#features`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  // ── 2. Auth pages (publicly accessible, lower crawl value) ───────────────
  const authPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/forgot-password`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];

  // ── 3. Static / legal pages ───────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  return [...publicPages, ...authPages, ...staticPages];
}
