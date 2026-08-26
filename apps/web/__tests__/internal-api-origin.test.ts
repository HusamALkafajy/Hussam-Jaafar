import { describe, expect, it } from 'vitest';
import { resolveInternalApiOrigin } from '../src/config/internal-api-origin';

describe('resolveInternalApiOrigin', () => {
  it('uses the IPv4 loopback fallback outside production', () => {
    expect(resolveInternalApiOrigin({ NODE_ENV: 'development' })).toBe(
      'http://127.0.0.1:4000',
    );
  });

  it('uses an explicit local override', () => {
    expect(
      resolveInternalApiOrigin({
        NODE_ENV: 'development',
        INTERNAL_API_URL: 'http://127.0.0.1:4100',
      }),
    ).toBe('http://127.0.0.1:4100');
  });

  it('uses the Docker service origin without exposing it to browser code', () => {
    expect(
      resolveInternalApiOrigin({
        NODE_ENV: 'production',
        INTERNAL_API_URL: 'http://api:4000',
      }),
    ).toBe('http://api:4000');
  });

  it('accepts an explicit HTTPS production origin', () => {
    expect(
      resolveInternalApiOrigin({
        NODE_ENV: 'production',
        INTERNAL_API_URL: 'https://api.example.test',
      }),
    ).toBe('https://api.example.test');
  });

  it('fails closed when production has no configured origin', () => {
    expect(() => resolveInternalApiOrigin({ NODE_ENV: 'production' })).toThrow(
      'INTERNAL_API_URL is required when NODE_ENV=production',
    );
  });

  it('rejects origins containing credentials', () => {
    const credentialedOrigin = ['https://user', ':', 'value', '@example.test'].join('');

    expect(() =>
      resolveInternalApiOrigin({
        NODE_ENV: 'production',
        INTERNAL_API_URL: credentialedOrigin,
      }),
    ).toThrow('without credentials');
  });

  it('rejects origins containing a path, query, or fragment', () => {
    expect(() =>
      resolveInternalApiOrigin({
        NODE_ENV: 'production',
        INTERNAL_API_URL: 'https://api.example.test/internal?debug=true',
      }),
    ).toThrow('without credentials, path, query, or fragment');
  });
});
