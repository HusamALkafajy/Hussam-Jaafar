import { Test, TestingModule } from '@nestjs/testing';
import { DocumentPersistenceService } from '../document-persistence.service';
import { RagService } from '../../../rag/rag.service';
import {
  client,
  db,
  type DatabaseExecutor,
  documentChunks,
  documentNodes,
  documentVersions,
  fileProcessingAttempts,
  files,
  users,
} from '@studyai/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { LostProcessingOwnershipError } from '../../utils/domain.exceptions';

describe('DocumentPersistenceService (PostgreSQL Integration)', () => {
  interface TestChunk {
    fileId: string;
    content: string;
    chunkIndex: number;
    pageNumber: number;
    embedding: number[];
  }

  let service: DocumentPersistenceService;
  let ragService: RagService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentPersistenceService,
        {
          provide: RagService,
          useValue: {
            persistChunks: jest.fn().mockImplementation(async (
              versionId: string,
              chunks: TestChunk[],
              tx: DatabaseExecutor,
            ) => {
              if (chunks && chunks.length > 0) {
                await tx.insert(documentChunks).values(chunks.map((chunk) => ({
                  fileId: chunk.fileId,
                  sessionId: 'test-session',
                  checkpointId: 'test-checkpoint',
                  versionId: versionId,
                  content: chunk.content,
                  embedding: chunk.embedding,
                  chunkIndex: chunk.chunkIndex,
                  pageNumber: chunk.pageNumber,
                })));
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentPersistenceService>(DocumentPersistenceService);
    ragService = module.get<RagService>(RagService);
  });

  afterAll(async () => {
    await client.end();
  });

  const setupFileAndAttempt = async (generation = 1, fileId = randomUUID(), attemptId = randomUUID()) => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: `${userId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'dummy',
    }).onConflictDoNothing();

    await db.insert(files).values({
      id: fileId,
      userId,
      originalName: 'test.pdf',
      storageKey: `test-${fileId}.pdf`,
      storageUrl: 'http://localhost',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'pending',
    });

    await db.insert(fileProcessingAttempts).values({
      id: attemptId,
      fileId,
      processingAttempts: generation,
      status: 'processing',
      queueJobId: `job-${attemptId}`,
    });

    return { fileId, attemptId, generation };
  };

  it('1. first publication creates V1', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt();

    await service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [
        { type: 'document', text: '', metadata: { generatedRoot: true, pageCount: 2 } },
        { type: 'paragraph', text: 'Hello', metadata: { sourcePage: 1 } },
      ],
      generatedChunks: [{ fileId, content: 'Hello', chunkIndex: 0, pageNumber: 1, embedding: new Array(1536).fill(0.1) }],
      extractionMetadata: { pageCount: 2 },
    });

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId));
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);

    const f = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    expect(f?.processingStatus).toBe('completed');
    expect(f?.pageCount).toBe(2);
    expect(f?.metadata).toMatchObject({ pageCount: 2 });

    const nodes = await db.select().from(documentNodes).where(eq(documentNodes.versionId, versions[0].id));
    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeType: 'document', metadata: expect.objectContaining({ pageCount: 2 }) }),
      expect.objectContaining({ nodeType: 'paragraph', metadata: expect.objectContaining({ sourcePage: 1 }) }),
    ]));
  });

  it('2. second independent attempt creates V2', async () => {
    const { fileId, attemptId: attempt1, generation: gen1 } = await setupFileAndAttempt(1);

    await service.publish({
      token: { attemptId: attempt1, fileId, generation: gen1 },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'V1' }],
      generatedChunks: [],
    });

    const attempt2 = randomUUID();
    const gen2 = 2;
    await db.insert(fileProcessingAttempts).values({
      id: attempt2,
      fileId,
      processingAttempts: gen2,
      status: 'processing',
      queueJobId: `job-${attempt2}`,
    });

    await service.publish({
      token: { attemptId: attempt2, fileId, generation: gen2 },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'V2' }],
      generatedChunks: [],
    });

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId)).orderBy(documentVersions.versionNumber);
    expect(versions).toHaveLength(2);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[1].versionNumber).toBe(2);
  });

  it('3. duplicate delivery cannot create another version', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt();

    await service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'Hello' }],
      generatedChunks: [],
    });

    // Duplicate delivery
    await service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'Hello' }],
      generatedChunks: [],
    });

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId));
    expect(versions).toHaveLength(1);
  });

  it('4. attemptId maps to at most one version', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt();

    await service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'Hello' }],
      generatedChunks: [],
    });

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.attemptId, attemptId));
    expect(versions).toHaveLength(1);
  });

  it('5. sequential attempts produce unique sequential versionNumbers', async () => {
    const { fileId, attemptId: attempt1, generation: gen1 } = await setupFileAndAttempt(1);

    await service.publish({
      token: { attemptId: attempt1, fileId, generation: gen1 },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'A' }],
      generatedChunks: [],
    });

    const attempt2 = randomUUID();
    const gen2 = 2;
    await db.insert(fileProcessingAttempts).values({
      id: attempt2,
      fileId,
      processingAttempts: gen2,
      status: 'processing',
      queueJobId: `job-${attempt2}`,
    });

    await service.publish({
      token: { attemptId: attempt2, fileId, generation: gen2 },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'B' }],
      generatedChunks: [],
    });

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId)).orderBy(documentVersions.versionNumber);
    expect(versions).toHaveLength(2);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[1].versionNumber).toBe(2);
  });

  it('6. stale generation cannot publish', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt(2);
    // But the DB says generation is 3
    await db.update(fileProcessingAttempts).set({ processingAttempts: 3 }).where(eq(fileProcessingAttempts.id, attemptId));

    await expect(service.publish({
      token: { attemptId, fileId, generation }, // Stale generation
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'Stale' }],
      generatedChunks: [],
    })).rejects.toThrow(LostProcessingOwnershipError);

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId));
    expect(versions).toHaveLength(0);
  });

  it('7. AST failure fully rolls back', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt();

    await expect(service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [], // Invalid blocks, AST build should fail
      generatedChunks: [],
    })).rejects.toThrow();

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId));
    expect(versions).toHaveLength(0);

    const attempt = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    expect(attempt?.status).toBe('processing'); // Not completed
  });

  it('8. RAG persistence failure fully rolls back', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt();

    (ragService.persistChunks as jest.Mock).mockRejectedValueOnce(new Error('RAG DB Error'));

    await expect(service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'A' }],
      generatedChunks: [{ fileId, content: 'Fail', chunkIndex: 0, pageNumber: 1, embedding: new Array(1536).fill(0.1) }],
    })).rejects.toThrow('RAG DB Error');

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId));
    expect(versions).toHaveLength(0);
  });

  it('15. publications for different files can proceed independently', async () => {
    const { fileId: f1, attemptId: a1, generation: g1 } = await setupFileAndAttempt(1);
    const { fileId: f2, attemptId: a2, generation: g2 } = await setupFileAndAttempt(1);

    const p1 = service.publish({
      token: { attemptId: a1, fileId: f1, generation: g1 },
      fileId: f1,
      structuralBlocks: [{ type: 'paragraph', text: 'F1' }],
      generatedChunks: [],
    });

    const p2 = service.publish({
      token: { attemptId: a2, fileId: f2, generation: g2 },
      fileId: f2,
      structuralBlocks: [{ type: 'paragraph', text: 'F2' }],
      generatedChunks: [],
    });

    await Promise.all([p1, p2]);

    const v1 = await db.select().from(documentVersions).where(eq(documentVersions.fileId, f1));
    expect(v1).toHaveLength(1);
    expect(v1[0].versionNumber).toBe(1);

    const v2 = await db.select().from(documentVersions).where(eq(documentVersions.fileId, f2));
    expect(v2).toHaveLength(1);
    expect(v2[0].versionNumber).toBe(1);
  });

  it('9. transaction rollback on terminal-state failure', async () => {
    const { fileId, attemptId, generation } = await setupFileAndAttempt();

    // Simulate terminal state failure by changing attempt status to failed before publish finishes
    // Actually, DocumentPersistenceService updates fileProcessingAttempts where status='processing'.
    // We can simulate failure by deleting the attempt record mid-flight, or just before publish!
    await db.delete(fileProcessingAttempts).where(eq(fileProcessingAttempts.id, attemptId));

    await expect(service.publish({
      token: { attemptId, fileId, generation },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'A' }],
      generatedChunks: [],
    })).rejects.toThrow(LostProcessingOwnershipError);

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId));
    expect(versions).toHaveLength(0); // Version rolled back because attempt transition failed
  });

  it('10. failed V2 preserves V1', async () => {
    const { fileId, attemptId: attempt1, generation: gen1 } = await setupFileAndAttempt(1);

    // Publish V1 successfully
    await service.publish({
      token: { attemptId: attempt1, fileId, generation: gen1 },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'V1' }],
      generatedChunks: [],
    });

    const attempt2 = randomUUID();
    const gen2 = 2;
    await db.insert(fileProcessingAttempts).values({
      id: attempt2,
      fileId,
      processingAttempts: gen2,
      status: 'processing',
      queueJobId: `job-${attempt2}`,
    });

    // Make RAG fail for V2
    (ragService.persistChunks as jest.Mock).mockRejectedValueOnce(new Error('RAG DB Error V2'));

    await expect(service.publish({
      token: { attemptId: attempt2, fileId, generation: gen2 },
      fileId,
      structuralBlocks: [{ type: 'paragraph', text: 'V2' }],
      generatedChunks: [],
    })).rejects.toThrow('RAG DB Error V2');

    const versions = await db.select().from(documentVersions).where(eq(documentVersions.fileId, fileId)).orderBy(documentVersions.versionNumber);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1); // V1 is fully preserved
  });
});
