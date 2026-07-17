import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { db, users, eq } from '@studyai/database';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

describe('QuotaInterceptor Lifecycle (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let redis: Redis;
  let token: string;
  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testEmail = 'test45@example.com';
  const tokenKey = `user:${testUserId}:tokens_consumed`;
  /** ADR-007: pending reservations live in this global Hash, keyed by reqId. */
  const pendingKey = 'global:pending_reservations';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);

    jwtService = app.get(JwtService);
    // eslint-disable-next-line no-restricted-syntax
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Ensure clean state
    await db.delete(users).where(eq(users.email, testEmail));
    
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      firstName: 'Test',
      lastName: 'User'
    });

    // Reset Redis
    await redis.del(tokenKey);
    await redis.del(pendingKey);

    token = jwtService.sign({ sub: testUserId, email: testEmail });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
    await redis.del(pendingKey);
    await redis.quit();
    await app.close();
  });

  it('1. Normal request commits reservation (100 tokens)', async () => {
    const url = await app.getUrl();
    const res = await fetch(`${url}/users/quota-test-lifecycle`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status).toBe(200);

    const consumed = await redis.get(tokenKey);
    expect(consumed).toBe('100');
  });

  it('2. Controller exception refunds reservation (remains 100)', async () => {
    const url = await app.getUrl();
    const res = await fetch(`${url}/users/quota-test-lifecycle?fail=controller`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status).toBe(400);

    // Wait a brief moment to ensure catchError/finalize completed the redis release
    await new Promise(r => setTimeout(r, 100));
    
    const consumed = await redis.get(tokenKey);
    expect(consumed).toBe('100'); // No additional tokens consumed
  });

  it('3. Client disconnection mid-stream refunds reservation (remains 100)', async () => {
    const url = await app.getUrl();
    const controller = new AbortController();
    
    // We simulate client aborting the request mid-stream by aborting before delay finishes
    const p = fetch(`${url}/users/quota-test-lifecycle?delay=500`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    }).catch(e => { /* expected abort error */ });

    // Abort request after 50ms (before controller finishes)
    setTimeout(() => controller.abort(), 50);
    await p;

    // Wait for NestJS server to process the client disconnection and run interceptor cleanup
    await new Promise(r => setTimeout(r, 1000));
    
    const consumed = await redis.get(tokenKey);
    expect(consumed).toBe('100'); // No additional tokens consumed
  });
});
