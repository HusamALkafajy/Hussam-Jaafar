import { NextFunction, Request, RequestHandler, Response } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const COOKIE_AUTH_PATHS = new Set(['/api/auth/refresh', '/api/auth/logout']);

function toOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function requestPath(request: Request): string {
  return request.path || request.originalUrl.split('?')[0];
}

/**
 * Protect the two endpoints that authenticate through the ambient refresh
 * cookie. Bearer-authenticated API requests are deliberately excluded: an
 * attacker cannot attach an Authorization header in a cross-site request.
 */
export function createCsrfProtectionMiddleware(
  allowedOrigins: readonly string[],
): RequestHandler {
  const trustedOrigins = new Set(
    allowedOrigins
      .map(toOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  );

  return (req: Request, res: Response, next: NextFunction) => {
    if (
      !STATE_CHANGING_METHODS.has(req.method.toUpperCase()) ||
      !COOKIE_AUTH_PATHS.has(requestPath(req)) ||
      !req.cookies?.refresh_token
    ) {
      return next();
    }

    const requestOrigin = toOrigin(req.get('origin')) ?? toOrigin(req.get('referer'));
    const headerToken = req.get('x-csrf-token');
    const cookieToken = req.cookies.csrf_token;

    if (
      !requestOrigin ||
      !trustedOrigins.has(requestOrigin) ||
      !headerToken ||
      !cookieToken ||
      headerToken !== cookieToken
    ) {
      return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
    }

    return next();
  };
}
