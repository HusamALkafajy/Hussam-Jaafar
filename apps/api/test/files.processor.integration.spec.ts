import { FilesProcessor } from '../src/modules/files/files.processor';
import { db, files, fileProcessingAttempts, documentVersions, users } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../src/modules/files/services/document-persistence.service';
import { RagService } from '../src/modules/rag/rag.service';
import { Readable } from 'stream';

describe('FilesProcessor (Integration with PostgreSQL)', () => {
  let processor: FilesProcessor;
  let stateRepository: FileProcessingStateRepository;
  let documentPersistenceService: DocumentPersistenceService;
  let pipelineRunner: { execute: jest.Mock };
  let storageProvider: { download: jest.Mock };
  
  let ragService: {
    generateChunkValues: jest.Mock;
    persistChunks: jest.Mock;
  };

  const globalUserId = randomUUID();

  beforeAll(async () => {
    // Ensure test user exists to satisfy foreign key constraints
    await db.insert(users).values({
      id: globalUserId,
      email: `processor-${globalUserId}@example.test`,
      firstName: 'Processor',
      lastName: 'User',
      passwordHash: 'hash',
    }).onConflictDoNothing();
  });

  beforeEach(() => {
    stateRepository = new FileProcessingStateRepository();
    
    ragService = {
      generateChunkValues: jest.fn().mockResolvedValue([]),
      persistChunks: jest.fn().mockResolvedValue(true),
    };

    documentPersistenceService = new DocumentPersistenceService(ragService as any);

    pipelineRunner = {
      execute: jest.fn().mockResolvedValue({
        extractedDocument: {
          fullText: 'extracted dummy text',
          blocks: [{ type: 'paragraph', text: 'extracted dummy text', metadata: {} }],
        },
        chunks: [],
      }),
    };

    storageProvider = {
      download: jest.fn().mockResolvedValue(Readable.from(Buffer.from('pdf fixture'))),
    };

    processor = new FilesProcessor(
      pipelineRunner as any,
      stateRepository,
      documentPersistenceService,
      { inc: jest.fn(), labels: jest.fn().mockReturnThis() } as any, // workerJobsTotal
      { inc: jest.fn(), labels: jest.fn().mockReturnThis() } as any, // checkpointJobsTotal
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any, // ocrDuration
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any, // embeddingDuration
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any, // dbTxDuration
      storageProvider as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setupFileAndAttempt = async () => {
    const fileId = randomUUID();
    const attemptId = randomUUID();
    const jobId = randomUUID();

    await db.insert(files).values({
      id: fileId,
      userId: globalUserId,
      originalName: 'test.pdf',
      storageKey: `test/${fileId}.pdf`,
      storageUrl: 'http://localhost/test.pdf',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      processingStatus: 'pending',
    });

    await db.insert(fileProcessingAttempts).values({
      id: attemptId,
      fileId,
      queueJobId: jobId,
      status: 'queued',
      processingAttempts: 0,
    });

    return { fileId, attemptId, jobId };
  };

  it('1: Successful extraction publishes document and transitions attempt to completed', async () => {
    const { fileId, attemptId, jobId } = await setupFileAndAttempt();

    pipelineRunner.execute.mockResolvedValue({
      extractedDocument: {
        fullText: 'test canonical text',
        blocks: [{ type: 'paragraph', text: 'test canonical text', metadata: {} }],
        metadata: { title: 'Integration PDF Title' },
      },
      chunks: [{
        plainText: 'test canonical text',
        chunkOrder: 0,
        structuralMetadata: { sourcePages: [1] },
      }],
    });
    
    ragService.generateChunkValues.mockResolvedValue([{
      fileId,
      content: 'test canonical text',
      chunkIndex: 0,
      pageNumber: 1,
      embedding: Array(1536).fill(0.1),
    }]);

    await processor.handle({ jobId, payload: { attemptId, fileId } });

    expect(pipelineRunner.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId,
        mimeType: 'application/pdf',
        filePath: expect.any(String),
      }),
      expect.objectContaining({ attemptId, fileId }),
    );
    expect(pipelineRunner.execute.mock.calls[0][0]).not.toHaveProperty('fileData');
    expect(storageProvider.download).toHaveBeenCalledWith('documents', `test/${fileId}.pdf`);
    
    // Verify attempt completed
    const attempt = await db.query.fileProcessingAttempts.findFirst({
      where: eq(fileProcessingAttempts.id, attemptId)
    });
    expect(attempt?.status).toBe('completed');
    expect(attempt?.finishedAt).toBeTruthy();

    // Verify file completed
    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });
    expect(file?.processingStatus).toBe('completed');
    expect(file?.metadata).toMatchObject({
      documentTitle: 'Integration PDF Title',
      documentTitleSource: 'metadata',
      titleConfirmed: false,
    });

    // Verify document versions
    const versions = await db.query.documentVersions.findMany({
      where: eq(documentVersions.fileId, fileId)
    });
    expect(versions.length).toBe(1);
    
    // Since documentVersions schema doesn't have fullText directly we'll assert something else
    // like the fact a version was created successfully.
    expect(versions[0]).toBeTruthy();
  });

  it('2: Extractor failure triggers typed error and terminal failure', async () => {
    const { fileId, attemptId, jobId } = await setupFileAndAttempt();

    pipelineRunner.execute.mockRejectedValue(new Error('Some generic error'));

    await processor.handle({ jobId, payload: { attemptId, fileId } });

    const attempt = await db.query.fileProcessingAttempts.findFirst({
      where: eq(fileProcessingAttempts.id, attemptId)
    });
    expect(attempt?.status).toBe('failed');
    expect(attempt?.lastError).toContain('Some generic error');
  });

  it('3: Extracted text with no generated chunks still publishes atomically', async () => {
    const { fileId, attemptId, jobId } = await setupFileAndAttempt();
    
    pipelineRunner.execute.mockResolvedValue({
      extractedDocument: {
        fullText: 'No generated chunks for this document.',
        blocks: [
          { type: 'paragraph', text: 'No generated chunks for this document.', metadata: {} },
        ],
      },
      chunks: [],
    });
    
    await processor.handle({ jobId, payload: { attemptId, fileId } });

    // RAG should not be called
    expect(ragService.generateChunkValues).not.toHaveBeenCalled();

    // Still completes successfully
    const attempt = await db.query.fileProcessingAttempts.findFirst({
      where: eq(fileProcessingAttempts.id, attemptId)
    });
    expect(attempt?.status).toBe('completed');
    
    const file = await db.query.files.findFirst({
      where: eq(files.id, fileId)
    });
    expect(file?.processingStatus).toBe('completed');
  });

});
