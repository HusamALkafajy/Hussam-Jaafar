import { FilesProcessor } from '../src/modules/files/files.processor';
import { db, files, fileProcessingAttempts, documentVersions, users } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { ErrorClassifier } from '../src/modules/files/utils/error-classifier.util';
import { FileProcessingStateRepository } from '../src/modules/files/repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../src/modules/files/services/document-persistence.service';
import { RagService } from '../src/modules/rag/rag.service';
import { ExtractorRegistry } from '../src/modules/files/services/extractor.registry';

describe('FilesProcessor (Integration with PostgreSQL)', () => {
  let processor: FilesProcessor;
  let stateRepository: FileProcessingStateRepository;
  let documentPersistenceService: DocumentPersistenceService;
  
  let mockExtractor: { extract: jest.Mock };
  let extractorRegistry: ExtractorRegistry;
  
  let ragService: {
    generateChunkValues: jest.Mock;
    persistChunks: jest.Mock;
  };

  const globalUserId = randomUUID();

  beforeAll(async () => {
    // Ensure test user exists to satisfy foreign key constraints
    await db.insert(users).values({
      id: globalUserId,
      email: 'processor-test@example.com',
      firstName: 'Processor',
      lastName: 'User',
      passwordHash: 'hash',
    }).onConflictDoNothing();
  });

  beforeEach(() => {
    mockExtractor = {
      extract: jest.fn().mockResolvedValue({ 
        fullText: 'test text', 
        blocks: [{ type: 'paragraph', text: 'test text', metadata: {} }] 
      }),
    };

    extractorRegistry = {
      getExtractor: jest.fn().mockReturnValue(mockExtractor),
      registerExtractor: jest.fn(),
    } as any;

    stateRepository = new FileProcessingStateRepository();
    
    ragService = {
      generateChunkValues: jest.fn().mockResolvedValue([]),
      persistChunks: jest.fn().mockResolvedValue(true),
    };

    documentPersistenceService = new DocumentPersistenceService(ragService as any);

    const pipelineRunner = {
      stages: [],
      registerStages: jest.fn(),
      execute: jest.fn().mockResolvedValue({
        chunks: [{ text: 'extracted dummy text', metadata: { pageNumber: 1 } }],
        metadata: { title: 'dummy' },
        rawText: 'extracted dummy text'
      })
    } as any;

    processor = new FilesProcessor(
      pipelineRunner,
      stateRepository,
      documentPersistenceService,
      { inc: jest.fn(), labels: jest.fn().mockReturnThis() } as any, // workerJobsTotal
      { inc: jest.fn(), labels: jest.fn().mockReturnThis() } as any, // checkpointJobsTotal
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any, // ocrDuration
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any, // embeddingDuration
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any // dbTxDuration
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

    mockExtractor.extract.mockResolvedValue({ 
      fullText: 'test canonical text', 
      blocks: [{ type: 'paragraph', text: 'test canonical text', metadata: {} }] 
    });
    
    ragService.generateChunkValues.mockResolvedValue([{
      fileId,
      content: 'test canonical text',
      chunkIndex: 0,
      pageNumber: 1,
      embedding: Array(1536).fill(0.1),
    }]);

    await processor.handle({ jobId, payload: { attemptId, fileId } });

    // Verify extraction was called with correct context
    expect(extractorRegistry.getExtractor).toHaveBeenCalledWith('application/pdf');
    
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

    mockExtractor.extract.mockRejectedValue(new Error('Some generic error'));

    await processor.handle({ jobId, payload: { attemptId, fileId } });

    const attempt = await db.query.fileProcessingAttempts.findFirst({
      where: eq(fileProcessingAttempts.id, attemptId)
    });
    expect(attempt?.status).toBe('failed');
    expect(attempt?.lastError).toContain('Some generic error');
  });

  it('3: Empty extraction publishes empty document but does not trigger RAG generation', async () => {
    const { fileId, attemptId, jobId } = await setupFileAndAttempt();
    
    // Empty extraction
    mockExtractor.extract.mockResolvedValue({ 
      fullText: 'No extractable text found in this document.', 
      blocks: [
        { type: 'paragraph', text: 'No extractable text found in this document.', metadata: {} }
      ] 
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
