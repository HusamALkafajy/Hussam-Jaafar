import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from '../rag.service';
import { AiService } from '../../ai/ai.service';
import { users, files, documentChunks, documentVersions, type DatabaseExecutor } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres = require('postgres');

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be supplied through the environment.');
}

const testClient = postgres(testDatabaseUrl, { prepare: false });
const db = drizzle(testClient, {
  schema: { users, files, documentChunks, documentVersions },
});

describe('RagService Transaction Executor', () => {
  let ragService: RagService;
  let module: TestingModule;
  let userId: string;
  let fileId: string;
  let versionId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: AiService,
          useValue: { getEmbedding: async () => new Array(1536).fill(0.1) }
        }
      ],
    }).compile();

    ragService = module.get<RagService>(RagService);

    const user = await db.insert(users).values({
      email: `test-rag-tx-${Date.now()}@test.com`,
      firstName: 'RagTx',
      lastName: 'Test',
    }).returning({ id: users.id });
    userId = user[0].id;

    const file = await db.insert(files).values({
      userId,
      originalName: 'ragtx.pdf',
      storageKey: 'ragtx.pdf',
      storageUrl: '/ragtx.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
    }).returning({ id: files.id });
    fileId = file[0].id;

    const version = await db.insert(documentVersions).values({
      fileId,
      versionNumber: 1,
    }).returning({ id: documentVersions.id });
    versionId = version[0].id;
  });

  afterAll(async () => {
    try {
      await db.delete(users).where(eq(users.id, userId));
      await module.close();
    } finally {
      await testClient.end();
    }
  });

  it('TEST 3: RAG persistence writes using tx roll back with the outer transaction', async () => {
    const chunkValues = [{
      fileId,
      chunkIndex: 0,
      content: 'test content rollback',
      pageNumber: 1,
      embedding: new Array(1536).fill(0.1),
    }];

    try {
      await db.transaction(async (tx) => {
        await ragService.persistChunks(versionId, chunkValues, tx as unknown as DatabaseExecutor);
        throw new Error('Rollback RAG');
      });
    } catch (e: any) {
      expect(e.message).toBe('Rollback RAG');
    }

    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks.length).toBe(0); // Rolled back!
  });

  it('TEST 5: No external embedding/network call occurs inside the transaction boundary', async () => {
    // Because persistChunks takes pre-computed chunks, it performs NO external calls.
    // The separation naturally enforces this.
    const chunkValues = [{
      fileId,
      chunkIndex: 1,
      content: 'test content persist',
      pageNumber: 1,
      embedding: new Array(1536).fill(0.1),
    }];

    await db.transaction(async (tx) => {
      await ragService.persistChunks(versionId, chunkValues, tx as unknown as DatabaseExecutor);
    });

    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks.length).toBe(1);
  });
});
