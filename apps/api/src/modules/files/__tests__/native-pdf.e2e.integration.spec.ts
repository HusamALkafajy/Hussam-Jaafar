import { Test, TestingModule } from '@nestjs/testing';
import { FilesProcessor } from '../files.processor';
import { ExtractorRegistry } from '../services/extractor.registry';
import { NativePdfExtractor } from '../services/extractors/native-pdf.extractor';
import { FileProcessingStateRepository } from '../repositories/file-processing-state.repository';
import { DocumentPersistenceService } from '../services/document-persistence.service';
import { db, files, fileProcessingAttempts, documentVersions, documentNodes, documentChunks, users, processingSessions, processingCheckpoints } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PDFDocument } from 'pdf-lib';

describe('Native PDF End-to-End Extraction Integration', () => {
  let processor: FilesProcessor;
  let tmpDir: string;
  let ragService: any;
  const globalUserId = randomUUID();

  beforeAll(async () => {
    tmpDir = path.join(process.cwd(), 'apps', 'api', 'uploads', 'pdf-e2e-tests');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // We MUST NOT MOCK ExtractorRegistry or NativePdfExtractor or pdfjs-dist.
    // We only mock RagService embedding generation because we don't want to hit real OpenAI APIs.
    ragService = {
      generateChunkValues: jest.fn().mockImplementation(async (fileId: string, content: string, startPage: number) => {
        return [{
          fileId,
          content: content,
          chunkIndex: 0,
          pageNumber: startPage,
          embedding: Array(1536).fill(0.1),
        }];
      }),
      persistChunks: jest.fn().mockImplementation(async (versionId: string, chunks: any[], tx: any) => {
        if (chunks.length === 0) return;
        // Use the provided transaction or fallback to global db
        const dbConn = tx || db;
        const dbChunks = chunks.map(c => ({
          ...c,
          id: randomUUID(),
          versionId, // we now have versionId
        }));
        await dbConn.insert(documentChunks).values(dbChunks);
      }),
    };

    const extractorRegistry = new ExtractorRegistry();
    extractorRegistry.register('application/pdf', new NativePdfExtractor());

    const documentPersistenceService = new DocumentPersistenceService(ragService as any);
    const stateRepository = new FileProcessingStateRepository();

    processor = new FilesProcessor(
      extractorRegistry,
      stateRepository,
      documentPersistenceService,
      ragService as any,
      { inc: jest.fn(), labels: jest.fn().mockReturnThis() } as any,
      { inc: jest.fn(), labels: jest.fn().mockReturnThis() } as any,
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any,
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any,
      { observe: jest.fn(), startTimer: jest.fn().mockReturnValue(jest.fn()), labels: jest.fn().mockReturnThis() } as any
    );

    await db.insert(users).values({
      id: globalUserId,
      email: `e2e-${globalUserId}@test.com`,
      firstName: 'E2E',
      lastName: 'User',
      passwordHash: 'hash',
    });
  });

  afterAll(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const createPdfFile = async (name: string, setup: (doc: PDFDocument) => void): Promise<string> => {
    const doc = await PDFDocument.create();
    setup(doc);
    const bytes = await doc.save();
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, bytes);
    return filePath;
  };

  const setupFileAndAttempt = async (filePath: string) => {
    const fileId = randomUUID();
    const attemptId = randomUUID();
    const jobId = randomUUID();

    await db.insert(files).values({
      id: fileId,
      userId: globalUserId,
      originalName: path.basename(filePath),
      storageKey: path.join('pdf-e2e-tests', path.basename(filePath)), // Match physical path inside uploads dir
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

    const sessionId = randomUUID();
    const checkpointId = randomUUID();
    await db.insert(processingSessions).values({ id: sessionId, fileId, status: 'pending', totalChunks: 1 });
    await db.insert(processingCheckpoints).values({ id: checkpointId, sessionId, chunkIndex: 0, startPage: 1, endPage: 5, status: 'pending' });

    return { fileId, attemptId, jobId };
  };

  it('PROVES real end-to-end extraction pipeline completes successfully on valid PDF', async () => {
    const filePath = await createPdfFile('e2e-valid.pdf', (doc) => {
      const page = doc.addPage([500, 500]);
      page.drawText('Real End-to-End Test Text');
    });

    const { fileId, attemptId, jobId } = await setupFileAndAttempt(filePath);

    // Act
    await processor.handle({ jobId, payload: { attemptId, fileId, generation: 1 } });

    // Assert Attempt and File completed
    const attempt = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    expect(attempt?.status).toBe('completed');

    const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    expect(file?.processingStatus).toBe('completed');

    // Assert Version created
    const versions = await db.query.documentVersions.findMany({ where: eq(documentVersions.fileId, fileId) });
    expect(versions).toHaveLength(1);

    // Assert AST nodes persisted
    const nodes = await db.query.documentNodes.findMany({ where: eq(documentNodes.versionId, versions[0].id) });
    expect(nodes.length).toBeGreaterThan(0);
    expect((nodes[0].content as any).text).toContain('Real End-to-End Test Text');
    expect(nodes[0].metadata).toMatchObject({ sourcePage: 1 });

    // Assert RAG chunks persisted
    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain('Real End-to-End Test Text');
  }, 30000);

  it('PROVES real end-to-end extraction pipeline fails predictably on invalid PDF without mutating downstream', async () => {
    const filePath = path.join(tmpDir, 'e2e-invalid.pdf');
    fs.writeFileSync(filePath, Buffer.from('this is not a pdf'));

    const { fileId, attemptId, jobId } = await setupFileAndAttempt(filePath);

    // Act
    await processor.handle({ jobId, payload: { attemptId, fileId, generation: 1 } });

    // Assert Attempt failed
    const attempt = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
    expect(attempt?.status).toBe('failed');
    expect(attempt?.errorCode).toBe('CORRUPTED_DOCUMENT');

    const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    expect(file?.processingStatus).toBe('failed');

    // Assert NO versions, NO AST nodes, NO chunks created
    const versions = await db.query.documentVersions.findMany({ where: eq(documentVersions.fileId, fileId) });
    expect(versions).toHaveLength(0);

    const chunks = await db.query.documentChunks.findMany({ where: eq(documentChunks.fileId, fileId) });
    expect(chunks).toHaveLength(0);
  }, 30000);
});
