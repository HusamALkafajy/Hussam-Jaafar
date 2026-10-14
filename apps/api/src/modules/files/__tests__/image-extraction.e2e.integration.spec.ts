import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IQueue } from '@studyai/infrastructure';
import { randomBytes, randomUUID } from 'crypto';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as request from 'supertest';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { FilesService } from '../files.service';
import { ExtractorRegistry } from '../services/extractor.registry';
import { LegacyFallbackAdapter } from '../services/extractors/legacy-fallback.adapter';

const EXPECTED_EXTRACTION = 'StudyAI image extraction integration verified.';
const VALID_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=',
  'base64',
);

type DatabaseModule = typeof import('@studyai/database');

describe('Image extraction end-to-end integration', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let database: DatabaseModule;
  let storageRoot: string;
  let uploadRoot: string;
  let userId: string | undefined;
  let accessToken: string;
  let providerFetch: jest.SpyInstance;
  let loggerError: jest.SpyInstance;
  let processingDirectoriesBefore: Set<string>;

  const listProcessingDirectories = (): Set<string> => new Set(
    fs.readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('studyai-processing-'))
      .map((entry) => entry.name),
  );

  const uploadChunk = (
    payload: Buffer,
    filename: string,
    declaredMime: string,
  ) => request(app.getHttpServer())
    .post('/api/files/upload/chunk')
    .set('Authorization', `Bearer ${accessToken}`)
    .field('uploadId', randomUUID())
    .field('chunkIndex', '0')
    .field('totalChunks', '1')
    .field('filename', filename)
    .field('fileSize', String(payload.length))
    .field('mimeType', declaredMime)
    .field('title', 'Integration image')
    .attach('file', payload, { filename, contentType: declaredMime });

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    const redisPort = process.env.TEST_REDIS_PORT;
    if (!databaseUrl?.includes('studyai_test')) {
      throw new Error('Image integration requires an isolated studyai_test database.');
    }
    if (!redisPort || !/^\d+$/.test(redisPort)) {
      throw new Error('Image integration requires TEST_REDIS_PORT for isolated Redis.');
    }

    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'studyai-image-storage-'));
    uploadRoot = path.join(storageRoot, 'upload-assembly');
    fs.mkdirSync(uploadRoot, { recursive: true });
    processingDirectoriesBefore = listProcessingDirectories();

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_HOST = process.env.TEST_REDIS_HOST ?? '127.0.0.1';
    process.env.REDIS_PORT = redisPort;
    process.env.STORAGE_PATH = storageRoot;
    process.env.FRONTEND_URL = 'http://127.0.0.1:3000';
    process.env.JWT_SECRET = randomBytes(48).toString('base64');
    process.env.JWT_REFRESH_SECRET = randomBytes(48).toString('base64');
    process.env.OPENROUTER_API_KEY = ['va021', 'controlled', 'boundary'].join('-');
    process.env.ALLOW_MOCK_DOCUMENT_EXTRACTION = 'false';
    delete process.env.GEMINI_API_KEY;

    providerFetch = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.endsWith('/chat/completions')) {
        throw new Error(`Unexpected external request boundary: ${new URL(url).pathname}`);
      }

      const requestBody = JSON.parse(String(init?.body));
      expect(requestBody.messages[1].content[1].image_url.url).toMatch(
        /^data:image\/jpeg;base64,/,
      );
      expect(new Headers(init?.headers).has('Authorization')).toBe(true);

      return new Response(JSON.stringify({
        choices: [{ message: { content: EXPECTED_EXTRACTION } }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    loggerError = jest.spyOn(Logger.prototype, 'error');

    const { AppModule } = await import('../../../app.module');
    database = await import('@studyai/database');
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useLogger(false);
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    app.useGlobalInterceptors(new TransformInterceptor());

    const filesService = moduleRef.get(FilesService);
    (filesService as unknown as { uploadDir: string }).uploadDir = uploadRoot;
    await app.init();

    const adapter = moduleRef.get(LegacyFallbackAdapter);
    const registry = moduleRef.get(ExtractorRegistry);
    expect((adapter as unknown as { aiService?: unknown }).aiService).toBeDefined();
    expect(registry.getExtractor('image/jpeg')).toBe(adapter);

    const accountCredential = `${randomBytes(32).toString('hex')}Aa1!`;
    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `va021-${randomUUID()}@example.test`,
        password: accountCredential,
        firstName: 'Image',
        lastName: 'Integration',
        locale: 'en',
      })
      .expect(201);

    userId = registration.body.data.user.id;
    accessToken = registration.body.data.accessToken;
    expect(userId).toBeDefined();
    expect(accessToken).toEqual(expect.any(String));
  }, 120_000);

  afterAll(async () => {
    if (userId && database) {
      await database.db.delete(database.users).where(database.eq(database.users.id, userId));
    }
    if (app) await app.close();
    if (providerFetch) providerFetch.mockRestore();
    if (loggerError) loggerError.mockRestore();
    if (storageRoot) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it('processes an authenticated JPEG through real storage, queue, worker, DI, and persistence', async () => {
    const upload = await uploadChunk(VALID_JPEG, 'verified-image.jpg', 'image/jpeg')
      .expect(201);
    const fileId = upload.body.data.id as string;
    expect(fileId).toEqual(expect.any(String));

    let publicFile: Record<string, unknown> | undefined;
    for (let poll = 0; poll < 80; poll += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      publicFile = response.body.data;
      if (publicFile?.processingStatus === 'completed' || publicFile?.processingStatus === 'failed') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(publicFile).toMatchObject({
      id: fileId,
      processingStatus: 'completed',
      extractedText: EXPECTED_EXTRACTION,
      processingError: null,
    });

    const file = await database.db.query.files.findFirst({
      where: database.eq(database.files.id, fileId),
    });
    expect(file?.processingStatus).toBe('completed');
    expect(file?.extractedText).toBe(EXPECTED_EXTRACTION);

    const attempts = await database.db.query.fileProcessingAttempts.findMany({
      where: database.eq(database.fileProcessingAttempts.fileId, fileId),
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ status: 'completed', errorCode: null });

    const versions = await database.db.query.documentVersions.findMany({
      where: database.eq(database.documentVersions.fileId, fileId),
    });
    expect(versions).toHaveLength(1);

    const storedFile = path.join(storageRoot, 'documents', file!.storageKey);
    expect(fs.readFileSync(storedFile)).toEqual(VALID_JPEG);
    expect(fs.readdirSync(uploadRoot, { recursive: true })).toHaveLength(1);
    expect(fs.readdirSync(path.join(uploadRoot, 'temp'))).toHaveLength(0);
    expect(listProcessingDirectories()).toEqual(processingDirectoriesBefore);

    const queue = moduleRef.get<IQueue>('RawQueue');
    expect(queue.getJobCounts).toBeDefined();
    const queueCounts = await queue.getJobCounts!() as Record<string, number>;
    expect(Object.values(queueCounts).reduce((sum, count) => sum + count, 0)).toBe(0);

    expect(providerFetch).toHaveBeenCalledTimes(1);
    const errorOutput = loggerError.mock.calls.flat().map(String).join('\n');
    expect(errorOutput).not.toContain('NATIVE_RUNTIME_BUG');
    expect(errorOutput).not.toContain("Cannot read properties of undefined (reading 'extractText')");
  }, 30_000);

  it.each([
    ['malformed', Buffer.from('not-an-image'), 'malformed.jpg', 'image/jpeg'],
    ['forged', Buffer.from('%PDF-1.4 forged image'), 'forged.jpg', 'image/jpeg'],
    ['mismatched', VALID_JPEG, 'mismatched.png', 'image/png'],
  ])('rejects %s image content honestly', async (_caseName, payload, filename, declaredMime) => {
    const response = await uploadChunk(payload, filename, declaredMime).expect(400);
    expect(response.body).toEqual(expect.objectContaining({
      errorCode: 'UNSUPPORTED_FILE_TYPE',
    }));
  });
});
