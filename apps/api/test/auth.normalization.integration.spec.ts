import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { db, users } from '@studyai/database';
import { eq, like } from 'drizzle-orm';

describe('Auth Email Normalization (Integration)', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    
    // Exact pipeline matching main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    // Clean up test users
    await db.delete(users).where(like(users.email, '%normalization.test%'));
    await app.close();
  });

  const generateEmail = (base: string) => `${base}-${Date.now()}@normalization.test`;

  it('1. leading/trailing whitespace is normalized', async () => {
    const emailBase = generateEmail('whitespace');
    const emailWithSpaces = `   ${emailBase}   `;
    const password = 'TestPassword123!';

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailWithSpaces,
        password,
        firstName: 'White',
        lastName: 'Space',
      });

    expect(res.status).toBe(201);
    
    // Verify it actually saved without spaces in DB
    const results = await db.select().from(users).where(eq(users.email, emailBase));
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe(emailBase);
  });

  it('2. uppercase email characters are normalized consistently', async () => {
    const emailBase = generateEmail('uppercase');
    const emailMixedCase = `UpPeR${emailBase}`;
    const emailExpected = emailMixedCase.toLowerCase();
    const password = 'TestPassword123!';

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailMixedCase,
        password,
        firstName: 'Upper',
        lastName: 'Case',
      });

    expect(res.status).toBe(201);

    const results = await db.select().from(users).where(eq(users.email, emailExpected));
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe(emailExpected);
  });

  it('3. already-normalized emails remain unchanged', async () => {
    const emailExpected = generateEmail('normal');
    const password = 'TestPassword123!';

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailExpected,
        password,
        firstName: 'Normal',
        lastName: 'Case',
      });

    expect(res.status).toBe(201);

    const results = await db.select().from(users).where(eq(users.email, emailExpected));
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe(emailExpected);
  });

  it('4. malformed emails remain rejected after normalization', async () => {
    const emailMalformed = `   not-an-email   `;
    const password = 'TestPassword123!';

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailMalformed,
        password,
        firstName: 'Bad',
        lastName: 'Email',
      });

    expect(res.status).toBe(400);
    // IsEmail creates message 'email must be an email'
    expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('email')]));
  });

  it('5. duplicate-account behavior remains correct after case normalization', async () => {
    const emailBase = generateEmail('duplicate');
    const password = 'TestPassword123!';

    // Register first one
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailBase,
        password,
        firstName: 'First',
        lastName: 'User',
      });

    // Try to register again with different casing and spaces
    const duplicateEmail = `  ${emailBase.toUpperCase()}  `;

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: duplicateEmail,
        password,
        firstName: 'Second',
        lastName: 'User',
      });

    // Since our database uniqueness is case-sensitive, this fails ONLY because
    // the application-level validation correctly transformed it first.
    expect(res.status).toBe(409); // ConflictException is returned for duplicate emails
  });

  it('6. login works consistently with normalized casing and whitespace where intended', async () => {
    const emailBase = generateEmail('login-test');
    const password = 'TestPassword123!';

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: emailBase,
        password,
        firstName: 'Login',
        lastName: 'Test',
      });

    // Login with different casing and spacing
    const loginEmail = `  ${emailBase.toUpperCase()}  `;

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
