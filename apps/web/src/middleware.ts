import { NextRequest, NextResponse } from 'next/server';

type Locale = 'ar' | 'en';

const SUPPORTED_LOCALES: Locale[] = ['ar', 'en'];
const DEFAULT_LOCALE: Locale = 'ar'; // Default to Arabic for Middle East focus
const COOKIE_NAME = 'locale';

/**
 * Resolve the best locale from the Accept-Language header.
 * Returns 'ar' if Arabic is the primary preference, otherwise 'en'.
 */
function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const preferred = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, q = 'q=1'] = part.trim().split(';');
      const quality = parseFloat(q.replace('q=', '')) || 1;
      return { lang: lang.trim().toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { lang } of preferred) {
    if (lang.startsWith('ar')) return 'ar';
    if (lang.startsWith('en')) return 'en';
  }

  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Read existing locale cookie
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value as Locale | undefined;

  // 2. Validate or detect
  const locale: Locale =
    cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)
      ? cookieLocale
      : detectLocaleFromHeader(request.headers.get('Accept-Language'));

  // 3. If the cookie was missing or invalid, set it so RSC and future requests read it
  if (!cookieLocale || !SUPPORTED_LOCALES.includes(cookieLocale)) {
    response.cookies.set(COOKIE_NAME, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false, // Must be readable by client JS for the LocaleProvider
    });
  }

  // 4. Forward the resolved locale as a request header for the RSC layout
  response.headers.set('x-locale', locale);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico).*)',
  ],
};
