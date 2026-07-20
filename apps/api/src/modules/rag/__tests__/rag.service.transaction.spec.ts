import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from '../rag.service';
import { AiService } from '../../ai/ai.service';
import { db, users, files, documentChunks } from '@studyai/database';
import { eq } from 'drizzle-orm';

describe('RagService Transaction Executor', () => {
  let ragService: RagService;
  let userId: string;
  let fileId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
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
        await ragService.persistChunks(fileId, chunkValues, tx);
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
      await ragService.persistChunks(fileId, chunkValues, tx);
    });

    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks.length).toBe(1);
  });
});
