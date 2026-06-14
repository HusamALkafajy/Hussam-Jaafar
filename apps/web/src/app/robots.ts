import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://studyai.com';

  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/login',
        '/register',
        '/forgot-password',
      ],
      disallow: [
        '/dashboard/',
        '/files/',
        '/exams/',
        '/flashcards/',
        '/analytics/',
        '/settings/',
        '/subscription/',
        '/admin/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
