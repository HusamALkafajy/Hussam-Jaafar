import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as request from 'supertest';
import { createCsrfProtectionMiddleware } from './csrf-protection.middleware';

describe('CSRF protection middleware', () => {
  const trustedOrigin = 'https://app.studyai.test';
  const sessionCookies = ['refresh_token=refresh-session', 'csrf_token=csrf-session'];

  function createApp() {
    const app = express();
    app.use(cookieParser());
    app.use(createCsrfProtectionMiddleware([trustedOrigin]));
    app.post('/api/auth/refresh', (_req, res) => res.status(204).end());
    app.post('/api/auth/logout', (_req, res) => res.status(204).end());
    app.post('/api/files', (_req, res) => res.status(204).end());
    return app;
  }

  it('allows a bearer-authenticated state change without an ambient cookie', async () => {
    await request(createApp())
      .post('/api/files')
      .set('Authorization', 'Bearer access-token-in-memory')
      .expect(204);
  });

  it('does not treat a legacy access_token cookie as cookie authentication', async () => {
    await request(createApp())
      .post('/api/auth/refresh')
      .set('Cookie', ['access_token=obsolete-access-token'])
      .expect(204);
  });

  it('rejects a refresh request with a refresh cookie but no CSRF header', async () => {
    await request(createApp())
      .post('/api/auth/refresh')
      .set('Origin', trustedOrigin)
      .set('Cookie', sessionCookies)
      .expect(403);
  });

  it('rejects a refresh request when the CSRF header does not match the cookie', async () => {
    await request(createApp())
      .post('/api/auth/refresh')
      .set('Origin', trustedOrigin)
      .set('X-CSRF-Token', 'different-token')
      .set('Cookie', sessionCookies)
      .expect(403);
  });

  it('allows refresh from the trusted origin with a matching double-submit token', async () => {
    await request(createApp())
      .post('/api/auth/refresh')
      .set('Origin', trustedOrigin)
      .set('X-CSRF-Token', 'csrf-session')
      .set('Cookie', sessionCookies)
      .expect(204);
  });

  it('accepts a trusted Referer when Origin is unavailable', async () => {
    await request(createApp())
      .post('/api/auth/refresh')
      .set('Referer', `${trustedOrigin}/files`)
      .set('X-CSRF-Token', 'csrf-session')
      .set('Cookie', sessionCookies)
      .expect(204);
  });

  it('rejects a cross-site refresh even when the double-submit token matches', async () => {
    await request(createApp())
      .post('/api/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('X-CSRF-Token', 'csrf-session')
      .set('Cookie', sessionCookies)
      .expect(403);
  });

  it('applies the same cookie-session protection to logout', async () => {
    await request(createApp())
      .post('/api/auth/logout')
      .set('Origin', trustedOrigin)
      .set('Cookie', sessionCookies)
      .expect(403);

    await request(createApp())
      .post('/api/auth/logout')
      .set('Origin', trustedOrigin)
      .set('X-CSRF-Token', 'csrf-session')
      .set('Cookie', sessionCookies)
      .expect(204);
  });
});
