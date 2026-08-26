type ApiOriginEnvironment = Readonly<{
  NODE_ENV?: string;
  INTERNAL_API_URL?: string;
}>;

const LOCAL_API_ORIGIN = 'http://127.0.0.1:4000';

/**
 * Resolves the server-only API origin used by Next.js rewrites.
 * Browser code must continue to call relative `/api` and `/uploads` paths.
 */
export function resolveInternalApiOrigin(
  environment: ApiOriginEnvironment = process.env,
): string {
  const configuredOrigin = environment.INTERNAL_API_URL?.trim();

  if (!configuredOrigin) {
    if (environment.NODE_ENV === 'production') {
      throw new Error('INTERNAL_API_URL is required when NODE_ENV=production');
    }

    return LOCAL_API_ORIGIN;
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredOrigin);
  } catch {
    throw new Error('INTERNAL_API_URL must be a valid absolute HTTP(S) origin');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('INTERNAL_API_URL must use HTTP or HTTPS');
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('INTERNAL_API_URL must be an origin without credentials, path, query, or fragment');
  }

  return parsed.origin;
}
