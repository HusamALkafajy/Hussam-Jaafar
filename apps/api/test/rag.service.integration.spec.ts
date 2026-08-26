import { Test, TestingModule } from '@nestjs/testing';
import { db, documentChunks, documentVersions, files, users, fileProcessingAttempts } from '@studyai/database';
import { RagService } from '../src/modules/rag/rag.service';
import { AiService } from '../src/modules/ai/ai.service';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

describe('RagService (Integration - Real Database)', () => {
  let ragService: RagService;
  let userId: string;
  let fileId: string;
  let attempt1Id: string;
  let attempt2Id: string;
  let version1Id: string;
  let version2Id: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: AiService,
          useValue: {
            getEmbedding: jest.fn().mockImplementation(async (text: string) => {
              // Mock a 1536-dim vector for pgvector
              const vector = new Array(1536).fill(0);
              // deterministic mock vector based on text
              vector[0] = text.includes('V1') ? 0.9 : 0.1;
              vector[1] = text.includes('V2') ? 0.9 : 0.1;
              return vector;
            }),
          },
        },
      ],
    }).compile();

    ragService = module.get<RagService>(RagService);

    // Setup foreign keys
    userId = uuidv4();
    fileId = uuidv4();
    attempt1Id = uuidv4();
    attempt2Id = uuidv4();
    version1Id = uuidv4();
    version2Id = uuidv4();

    await db.insert(users).values({ id: userId, email: `test-rag-${Date.now()}@example.com`, passwordHash: 'hash', firstName: 'Test', lastName: 'User' });
    await db.insert(files).values({ id: fileId, userId, originalName: 'test.pdf', storageKey: 'test.pdf', storageUrl: 'http://localhost/test.pdf', fileType: 'pdf', mimeType: 'application/pdf', fileSize: 100 });
    
    await db.insert(fileProcessingAttempts).values([
      { id: attempt1Id, fileId, queueJobId: 'job-1', processingAttempts: 1, status: 'completed' },
      { id: attempt2Id, fileId, queueJobId: 'job-2', processingAttempts: 2, status: 'completed' }
    ]);

    await db.insert(documentVersions).values([
      { id: version1Id, fileId, attemptId: attempt1Id, versionNumber: 1, createdBy: userId },
      { id: version2Id, fileId, attemptId: attempt2Id, versionNumber: 2, createdBy: userId },
    ]);
  });

  afterAll(async () => {
    await db.delete(files).where(eq(files.id, fileId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('1. A chunk cannot reference a nonexistent version', async () => {
    const chunkValues = await ragService.generateChunkValues(fileId, 'text', 1);
    await expect(ragService.persistChunks(uuidv4(), chunkValues)).rejects.toThrow();
  });

  it('2. V1 and V2 chunks coexist and searching V1 returns only V1 chunks', async () => {
    const v1Text = 'This is V1 unique content';
    const v2Text = 'This is V2 unique content';

    // Index V1
    const v1Chunks = await ragService.generateChunkValues(fileId, v1Text, 1);
    await ragService.persistChunks(version1Id, v1Chunks);

    // Index V2
    const v2Chunks = await ragService.generateChunkValues(fileId, v2Text, 1);
    await ragService.persistChunks(version2Id, v2Chunks);

    // 3. V1 and V2 chunks coexist
    const dbV1Chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.versionId, version1Id) });
    const dbV2Chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.versionId, version2Id) });
    
    expect(dbV1Chunks.length).toBeGreaterThan(0);
    expect(dbV2Chunks.length).toBeGreaterThan(0);

    // 4. Searching V1 returns only V1 chunks
    const searchV1 = await ragService.searchChunks(version1Id, 'V1');
    expect(searchV1.length).toBeGreaterThan(0);
    expect(searchV1[0].content).toContain('V1');

    // 5. Searching V2 returns only V2 chunks
    const searchV2 = await ragService.searchChunks(version2Id, 'V2');
    expect(searchV2.length).toBeGreaterThan(0);
    expect(searchV2[0].content).toContain('V2');

    // 6. V1 search never returns V2 chunks
    const v1ResultsForV2 = searchV1.filter(c => c.content.includes('V2'));
    expect(v1ResultsForV2).toHaveLength(0);

    // 7. V2 search never returns V1 chunks
    const v2ResultsForV1 = searchV2.filter(c => c.content.includes('V1'));
    expect(v2ResultsForV1).toHaveLength(0);
  });

  it('8. Publishing V2 chunks does not delete V1 chunks', async () => {
    const dbV1Chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.versionId, version1Id) });
    expect(dbV1Chunks.length).toBeGreaterThan(0);
  });

  it('9. Failed transaction inserting V2 chunks leaves V1 intact', async () => {
    try {
      await db.transaction(async (tx) => {
        const chunks = await ragService.generateChunkValues(fileId, 'Failing V3 text', 1);
        await ragService.persistChunks(version1Id, chunks, tx);
        throw new Error('Simulated failure');
      });
    } catch (e) {
      expect((e as Error).message).toBe('Simulated failure');
    }

    const searchV1 = await ragService.searchChunks(version1Id, 'V1');
    const failingResults = searchV1.filter(c => c.content.includes('Failing'));
    expect(failingResults).toHaveLength(0);
  });

  it('16. Empty generated chunk input behaves deterministically', async () => {
    await ragService.persistChunks(version1Id, []); // should not throw
  });
});
