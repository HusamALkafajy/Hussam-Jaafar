import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { CANONICAL_UPLOAD_FORMATS } from '../../common/constants/file-formats.constant';
import { db } from '@studyai/database';
import { files, subscriptions, users, subjects, fileProcessingAttempts, documentVersions } from '@studyai/database';
import { eq, and, or, sql, desc } from '@studyai/database';

import { FileType, ProcessingStatus, UserRole } from '@studyai/types';
import { AiService } from '../ai/ai.service';
import { RagService } from '../rag/rag.service';
import { FileProcessingDispatcherService } from './services/file-processing-dispatcher.service';

const USE_BULLMQ_PROCESSING = true;
import { GamificationService } from '../study-coach/gamification.service';
import { DocumentReadService } from '../document-read/document-read.service';
import { FileQueryDto } from './dto/file-query.dto';

import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { ConfigService } from '@nestjs/config';
import { IStorageProvider } from '@studyai/infrastructure';
import { randomUUID } from 'crypto';
import {
  assertUploadSize,
  MAX_UPLOAD_CHUNKS,
  UPLOAD_CHUNK_BYTES,
  UploadErrorCode,
  UploadException,
  validateUploadHeader,
  validateUploadPath,
} from '../../common/files/upload-contract';
import {
  createInitialDocumentTitle,
  getStoredDocumentTitle,
} from './utils/document-title.util';

interface ChunkUploadManifest {
  userId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  subjectId?: string;
  title?: string;
}

export class UnsatisfiableByteRangeException extends HttpException {
  constructor(
    public readonly completeLength: number,
    message = 'Requested range is not satisfiable.',
  ) {
    super(message, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private uploadDir = path.resolve(process.cwd(), 'apps/api/uploads');
  private readonly storageBucket = 'documents';

  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly gamificationService: GamificationService,
    private readonly dispatcherService: FileProcessingDispatcherService,
    private readonly configService: ConfigService,
    private readonly documentReadService: DocumentReadService,
    @Inject('IStorageProvider') private readonly storageProvider: IStorageProvider,
  ) {
    this.ensureUploadDir();
    const openrouterKey = this.configService.get<string>('ai.openrouterApiKey');
    const geminiKey = this.configService.get<string>('ai.geminiApiKey');
    const isTestEnvironment = this.configService.get<string>('app.nodeEnv') === 'test';
    const mockExtractionAllowed = this.configService.get<boolean>('ai.allowMockDocumentExtraction') === true;
    if (!openrouterKey && !geminiKey && isTestEnvironment && mockExtractionAllowed) {
      this.logger.warn(
        '[FilesService] Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is set. ' +
        'Document processing will run in MOCK MODE — extracted text will be fake placeholder content. ' +
        'Set one of these keys in apps/api/.env to enable real PDF/image parsing.',
      );
    }
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (e) {
      this.logger.error('Failed to create upload directory', e);
    }
  }

  // ── Subjects CRUD ──

  async createSubject(userId: string, data: { name: string; color?: string; icon?: string }) {
    const result = await db
      .insert(subjects)
      .values({
        userId,
        name: data.name,
        color: data.color || '#3B82F6',
        icon: data.icon || 'BookOpen',
      })
      .returning();
    return result[0];
  }

  async findSubjects(userId: string) {
    return db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(desc(subjects.createdAt));
  }

  async updateSubject(id: string, userId: string, data: { name?: string; color?: string; icon?: string }) {
    const result = await db
      .update(subjects)
      .set(data)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException('Subject not found');
    }
    return result[0];
  }

  async deleteSubject(id: string, userId: string) {
    // Set file subjectIds to null first (handled by set null on delete constraint in postgres schema)
    const result = await db
      .delete(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException('Subject not found');
    }
  }

  // ── Files CRUD & Processing ──

  async createFile(
    userId: string,
    expressFile: Express.Multer.File,
    subjectId?: string,
    title?: string,
  ) {
    let fileRecord;
    try {
      fileRecord = await this.registerAndProcessFile(
        userId,
        expressFile.path,
        expressFile.originalname,
        expressFile.mimetype,
        expressFile.size,
        subjectId,
        title,
      );
    } finally {
      await fs.unlink(expressFile.path).catch(() => undefined);
    }

    // Award gamification challenge progress for file upload (fire-and-forget)
    this.gamificationService
      .updateChallengeProgress(userId, 'upload', 1)
      .catch((err) => this.logger.warn('Challenge progress update failed:', err));

    return fileRecord;
  }

  /**
   * Outer wrapper: races the real processing logic against a hard 5-minute deadline.
   * If the deadline fires first, the file is marked FAILED so the UI never spins forever.
   */
  private async processFileBackground(
    fileId: string,
    filePath: string,
    type: FileType,
    mime: string,
  ): Promise<void> {
    const HARD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Processing hard-timeout: exceeded ${HARD_TIMEOUT_MS / 1000}s`)),
        HARD_TIMEOUT_MS,
      ),
    );

    try {
      await Promise.race([
        this._doProcessFile(fileId, filePath, type, mime),
        timeoutPromise,
      ]);
    } catch (e: any) {
      // Top-level safety net: catch anything _doProcessFile or the timeout throws.
      // _doProcessFile already sets FAILED on internal errors, but if it throws
      // before reaching its own catch (e.g., the initial PROCESSING update fails),
      // we catch it here and write FAILED ourselves.
      this.logger.error(`[processFileBackground] Fatal error for file ${fileId}: ${e?.message || e}`);
      await db
        .update(files)
        .set({
          processingStatus: ProcessingStatus.FAILED,
          processingError: e?.message || 'Unknown fatal processing error',
        })
        .where(eq(files.id, fileId))
        .catch((dbErr) =>
          this.logger.error(`Failed to write FAILED status for file ${fileId}:`, dbErr),
        );
    }
  }

  /**
   * Core processing logic. Always terminates by setting processingStatus to
   * COMPLETED or FAILED — never leaves the record in PROCESSING.
   */
  private async _doProcessFile(
    fileId: string,
    filePath: string,
    type: FileType,
    mime: string,
  ): Promise<void> {
    this.logger.log(`Background processing started for File ID: ${fileId}`);

    // Mark PROCESSING. Wrap in its own try/catch so a DB blip here
    // is surfaced immediately rather than silently leaving the file in PENDING.
    try {
      await db
        .update(files)
        .set({ processingStatus: ProcessingStatus.PROCESSING })
        .where(eq(files.id, fileId));
    } catch (dbErr: any) {
      throw new Error(`Failed to update status to PROCESSING: ${dbErr?.message || dbErr}`);
    }

    try {
      let extractedText = '';

      if (type === FileType.PDF || type === FileType.IMAGE) {
        // Use the configured AI provider for PDFs and OCR images
        extractedText = await this.aiService.extractText(filePath, mime);
      } else if (type === FileType.DOCX) {
        // Use mammoth for Word files locally (no external network call)
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else {
        throw new Error('Unsupported file type in pipeline');
      }

      // If extraction returned no text, use a friendly fallback so UI stops loading
      if (!extractedText || extractedText.trim() === '') {
        this.logger.warn(`Empty extracted text for File ID: ${fileId}. Saving fallback message.`);
        extractedText = 'No extractable text found in this document.';
      }

      await db
        .update(files)
        .set({
          extractedText,
          processingStatus: ProcessingStatus.COMPLETED,
          processedAt: new Date(),
        })
        .where(eq(files.id, fileId));

      this.logger.log(`Background processing completed successfully for File ID: ${fileId}`);
      // RAG indexing is deferred to C.3 DocumentPersistenceService

      // Increment subject fileCount (best-effort)
      try {
        const fileRecord = await db
          .select({ subjectId: files.subjectId })
          .from(files)
          .where(eq(files.id, fileId))
          .limit(1);

        if (fileRecord.length > 0 && fileRecord[0].subjectId) {
          await db
            .update(subjects)
            .set({ fileCount: sql`${subjects.fileCount} + 1` })
            .where(eq(subjects.id, fileRecord[0].subjectId));
        }
      } catch (countErr) {
        this.logger.warn(`Non-fatal: Failed to increment subject fileCount for file ${fileId}:`, countErr);
      }
    } catch (e: any) {
      this.logger.error(`Failed to process File ID: ${fileId}`, e);
      // Always set FAILED so the frontend doesn't spin forever.
      await db
        .update(files)
        .set({
          processingStatus: ProcessingStatus.FAILED,
          processingError: e?.message || 'Unknown processing error',
        })
        .where(eq(files.id, fileId))
        .catch((dbErr) =>
          this.logger.error(`CRITICAL: Could not write FAILED status for file ${fileId}:`, dbErr),
        );
    }
  }

  async findAll(userId: string, query: FileQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(files.userId, userId)];

    if (query.subjectId) {
      conditions.push(eq(files.subjectId, query.subjectId));
    }
    if (query.fileType) {
      conditions.push(eq(files.fileType, query.fileType));
    }
    if (query.search) {
      conditions.push(or(
        sql`${files.originalName} ILIKE ${`%${query.search}%`}`,
        sql`${files.metadata}->>'documentTitle' ILIKE ${`%${query.search}%`}`,
      )!);
    }

    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(files)
      .where(whereClause)
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset);

    // Get count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(files)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    return {
      data: data.map((file) => this.toPublicFile(file)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, userId: string) {
    const result = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('File not found');
    }
    return result[0];
  }

  async getPublicFileById(id: string, userId: string) {
    return this.toPublicFile(await this.findById(id, userId));
  }

  async openOriginalFile(id: string, userId: string, rangeHeader?: string) {
    const file = await this.findById(id, userId);
    if (!(await this.storageProvider.exists(this.storageBucket, file.storageKey))) {
      throw new NotFoundException('Original file is no longer available.');
    }

    const size = await this.storageProvider.getSize(this.storageBucket, file.storageKey);
    const range = this.parseByteRange(rangeHeader, size);
    const stream = await this.storageProvider.download(this.storageBucket, file.storageKey, range);

    return {
      stream,
      fileName: this.safeInlineFilename(file.originalName),
      mimeType: file.mimeType,
      size,
      range,
    };
  }

  async search(userId: string, q: string) {
    if (!q) return [];
    const results = await db
      .select({
        id: files.id,
        originalName: files.originalName,
        metadata: files.metadata,
        fileType: files.fileType,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          or(
            sql`${files.originalName} ILIKE ${`%${q}%`}`,
            sql`${files.metadata}->>'documentTitle' ILIKE ${`%${q}%`}`,
            sql`${files.extractedText} ILIKE ${`%${q}%`}`,
          ),
        ),
      )
      .limit(20);
    return results.map(({ metadata, ...file }) => ({
      ...file,
      title: getStoredDocumentTitle(metadata, file.originalName),
    }));
  }

  async deleteFile(id: string, userId: string) {
    const file = await this.findById(id, userId);

    // 1. Delete through the storage boundary. A missing object is equivalent
    // to an already-deleted object, so DB cleanup remains safe to retry.
    try {
      await this.storageProvider.delete(this.storageBucket, file.storageKey);
    } catch (e) {
      this.logger.warn(`Failed to delete storage object for file ${id}`, e);
    }

    // 2. Delete database record
    await db.delete(files).where(eq(files.id, id));

    // 3. Decrement subject fileCount if applicable
    if (file.subjectId) {
      await db
        .update(subjects)
        .set({ fileCount: sql`GREATEST(0, ${subjects.fileCount} - 1)` })
        .where(eq(subjects.id, file.subjectId));
    }
  }

  async assignSubject(id: string, subjectId: string | null, userId: string) {
    const file = await this.findById(id, userId);
    const oldSubjectId = file.subjectId;

    if (subjectId) {
      const subject = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
        .limit(1);
      if (subject.length === 0) {
        throw new NotFoundException('Subject not found');
      }
    }

    await db
      .update(files)
      .set({ subjectId, updatedAt: new Date() })
      .where(eq(files.id, id));

    // Update counts
    if (oldSubjectId) {
      await db
        .update(subjects)
        .set({ fileCount: sql`GREATEST(0, ${subjects.fileCount} - 1)` })
        .where(eq(subjects.id, oldSubjectId));
    }
    if (subjectId) {
      await db
        .update(subjects)
        .set({ fileCount: sql`${subjects.fileCount} + 1` })
        .where(eq(subjects.id, subjectId));
    }
  }

  // ── AI Methods ──

  async generateSummary(fileId: string, userId: string, level: string, language = 'en') {
    const file = await this.findById(fileId, userId);
    if (!this.hasUsableExtractedText(file)) {
      throw new BadRequestException('File is not processed yet');
    }
    return this.aiService.generateSummary(file.extractedText!, level, language);
  }

  async generateExplanation(fileId: string, userId: string, level: string, language = 'en') {
    const file = await this.findById(fileId, userId);
    if (!this.hasUsableExtractedText(file)) {
      throw new BadRequestException('File is not processed yet');
    }
    return this.aiService.generateExplanation(file.extractedText!, level, language, fileId, userId);
  }

  async chatWithDocument(fileId: string, userId: string, question: string) {
    const file = await this.findById(fileId, userId);
    if (!this.hasUsableExtractedText(file)) {
      throw new BadRequestException('File is not processed yet');
    }

    const bypassQuota = await this.isSuperAdmin(userId);

    // Check subscription monthly questions quota
    const sub = !bypassQuota
      ? await db
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
          .limit(1)
      : [];

    if (sub.length > 0) {
      const subscription = sub[0];
      if (subscription.questionsUsedThisMonth >= subscription.monthlyQuestionLimit) {
        throw new ForbiddenException('Monthly AI question limit exceeded (SaaS Quota)');
      }
    }

    let versionId: string | null = null;
    try {
      const result = await this.documentReadService.resolveActiveReadableVersion(fileId, userId);
      versionId = result.versionId;
    } catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
    }
    let chunks: any[] = [];
    if (versionId) {
      chunks = await this.ragService.searchChunks(versionId, question, 5);
    }
    const contextText = chunks
      .map((c) => `[Page ${c.pageNumber}] ${c.content}`)
      .join('\n\n');

    const chatResult = await this.aiService.chatWithDocument(
      contextText || file.extractedText!,
      question,
      [],
    );

    // Increment questions count inside subscription
    if (sub.length > 0) {
      await db
        .update(subscriptions)
        .set({ questionsUsedThisMonth: sql`${subscriptions.questionsUsedThisMonth} + 1` })
        .where(eq(subscriptions.id, sub[0].id));
    }

    return chatResult;
  }

  async handleChunkUpload(
    userId: string,
    chunkBuffer: Buffer,
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    filename: string,
    fileSize: number,
    mimeType: string,
    subjectId?: string,
    title?: string,
  ) {
    assertUploadSize(fileSize);
    const safeUploadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId);
    const safeFilename = typeof filename === 'string' &&
      path.basename(filename) === filename &&
      filename.length > 0 &&
      filename.length <= 255;
    const safeMimeType = typeof mimeType === 'string' && mimeType.length > 0 && mimeType.length <= 100;
    const safeSubjectId = subjectId === undefined ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subjectId);
    const normalizedTitle = typeof title === 'string' ? title.trim() : title;
    const safeTitle = normalizedTitle === undefined ||
      (typeof normalizedTitle === 'string' && normalizedTitle.length <= 255);
    const expectedTotalChunks = Math.ceil(fileSize / UPLOAD_CHUNK_BYTES);
    if (
      !safeUploadId ||
      !safeFilename ||
      !safeMimeType ||
      !safeSubjectId ||
      !safeTitle ||
      !Number.isInteger(chunkIndex) ||
      !Number.isInteger(totalChunks) ||
      totalChunks !== expectedTotalChunks ||
      totalChunks < 1 ||
      totalChunks > MAX_UPLOAD_CHUNKS ||
      chunkIndex < 0 ||
      chunkIndex >= totalChunks
    ) {
      throw new UploadException(UploadErrorCode.INVALID_UPLOAD, 'Invalid chunk upload metadata.');
    }

    const expectedChunkSize = chunkIndex === totalChunks - 1
      ? fileSize - chunkIndex * UPLOAD_CHUNK_BYTES
      : UPLOAD_CHUNK_BYTES;
    if (chunkBuffer.length !== expectedChunkSize) {
      throw new UploadException(UploadErrorCode.INVALID_UPLOAD, 'Chunk size does not match the upload contract.');
    }

    const tempDir = path.join(this.uploadDir, 'temp', uploadId);
    const manifestPath = path.join(tempDir, 'manifest.json');
    const manifest: ChunkUploadManifest = {
      userId,
      filename,
      fileSize,
      mimeType,
      totalChunks,
      subjectId,
      title: normalizedTitle,
    };
    let finalPath: string | undefined;

    try {
      if (chunkIndex === 0) {
        validateUploadHeader(chunkBuffer, mimeType, filename);
        await fs.mkdir(path.dirname(tempDir), { recursive: true });
        await fs.mkdir(tempDir, { recursive: false });
        await fs.writeFile(manifestPath, JSON.stringify(manifest), { flag: 'wx' });
      } else {
        const existing = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ChunkUploadManifest;
        if (JSON.stringify(existing) !== JSON.stringify(manifest)) {
          throw new UploadException(UploadErrorCode.INVALID_UPLOAD, 'Chunk upload metadata changed during transfer.');
        }
      }

      await fs.writeFile(path.join(tempDir, `chunk_${chunkIndex}`), chunkBuffer, { flag: 'wx' });
      if (chunkIndex !== totalChunks - 1) {
        return { success: true, message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded` };
      }

      finalPath = path.join(this.uploadDir, `${randomUUID()}${path.extname(filename).toLowerCase()}`);
      const output = await fs.open(finalPath, 'wx');
      try {
        for (let i = 0; i < totalChunks; i += 1) {
          for await (const bytes of createReadStream(path.join(tempDir, `chunk_${i}`))) {
            await output.write(bytes as Buffer);
          }
        }
      } finally {
        await output.close();
      }

      const finalSize = (await fs.stat(finalPath)).size;
      if (finalSize !== fileSize) {
        await fs.unlink(finalPath).catch(() => undefined);
        throw new UploadException(UploadErrorCode.INVALID_UPLOAD, 'Assembled file size does not match the upload contract.');
      }
      const detectedMime = await validateUploadPath(finalPath, mimeType, filename, finalSize);
      return await this.registerAndProcessFile(
        userId,
        finalPath,
        filename,
        detectedMime,
        finalSize,
        subjectId,
        normalizedTitle,
      );
    } catch (error) {
      if (finalPath) await fs.unlink(finalPath).catch(() => undefined);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    } finally {
      if (chunkIndex === totalChunks - 1) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  async registerAndProcessFile(
    userId: string,
    filePath: string,
    originalname: string,
    mime: string,
    size: number,
    subjectId?: string,
    title?: string,
  ) {
    assertUploadSize(size);
    const bypassQuota = await this.isSuperAdmin(userId);

    // Check subscription monthly upload quota
    const sub = !bypassQuota
      ? await db
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
          .limit(1)
      : [];

    if (sub.length > 0) {
      const subscription = sub[0];
      if (subscription.filesUsedThisMonth >= subscription.monthlyFileLimit) {
        throw new UploadException(
          UploadErrorCode.QUOTA_EXCEEDED,
          'Monthly file upload limit exceeded.',
          HttpStatus.FORBIDDEN,
          {
            limitType: 'files',
            used: subscription.filesUsedThisMonth,
            limit: subscription.monthlyFileLimit,
            tier: subscription.plan,
          },
        );
      }
    }

    // Determine file type
    const fileType = CANONICAL_UPLOAD_FORMATS[mime];
    if (!fileType) {
      throw new UploadException(UploadErrorCode.UNSUPPORTED_FILE_TYPE, 'Unsupported file type.');
    }

    // Validate subject if provided
    if (subjectId) {
      const subject = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
        .limit(1);
      if (subject.length === 0) {
        throw new NotFoundException('Subject not found');
      }
    }

    const storageKey = this.createStorageKey(userId, originalname);
    const storageUrl = 'private://document';
    try {
      await this.storageProvider.upload(
        this.storageBucket,
        storageKey,
        createReadStream(filePath),
        { contentType: mime, contentLength: size },
      );
    } catch {
      await fs.unlink(filePath).catch(() => undefined);
      throw new UploadException(
        UploadErrorCode.STORAGE_FAILED,
        'The file could not be stored.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const initialMetadata = createInitialDocumentTitle(originalname, title);
    const attemptId = randomUUID();
    let fileRecord: typeof files.$inferSelect;
    try {
      fileRecord = await db.transaction(async (tx) => {
        const lockedSub = !bypassQuota
          ? await tx
              .select()
              .from(subscriptions)
              .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
              .limit(1)
              .for('update')
          : [];
        if (lockedSub[0] && lockedSub[0].filesUsedThisMonth >= lockedSub[0].monthlyFileLimit) {
          throw new UploadException(
            UploadErrorCode.QUOTA_EXCEEDED,
            'Monthly file upload limit exceeded.',
            HttpStatus.FORBIDDEN,
            {
              limitType: 'files',
              used: lockedSub[0].filesUsedThisMonth,
              limit: lockedSub[0].monthlyFileLimit,
              tier: lockedSub[0].plan,
            },
          );
        }
        if (subjectId) {
          const ownedSubject = await tx
            .select({ id: subjects.id })
            .from(subjects)
            .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
            .limit(1);
          if (ownedSubject.length === 0) throw new NotFoundException('Subject not found');
        }
        const [createdFile] = await tx
          .insert(files)
          .values({
            userId,
            subjectId: subjectId || null,
            originalName: originalname,
            storageKey,
            storageUrl,
            fileType,
            mimeType: mime,
            fileSize: size,
            metadata: initialMetadata,
            processingStatus: ProcessingStatus.PENDING,
          })
          .returning();
        if (lockedSub[0]) {
          await tx
            .update(subscriptions)
            .set({ filesUsedThisMonth: sql`${subscriptions.filesUsedThisMonth} + 1` })
            .where(eq(subscriptions.id, lockedSub[0].id));
        }
        await tx.insert(fileProcessingAttempts).values({
          id: attemptId,
          fileId: createdFile.id,
          queueJobId: `file-processing_${attemptId}`,
        });
        return createdFile;
      });
    } catch (error) {
      await this.storageProvider.delete(this.storageBucket, storageKey).catch(() => undefined);
      throw error;
    } finally {
      await fs.unlink(filePath).catch(() => undefined);
    }
    await this.dispatcherService.dispatchAttempt(attemptId).catch((error) => {
      this.logger.error(`Failed to dispatch attempt ${attemptId}`, error);
    });
    return this.toPublicFile(fileRecord);
  }

  async reprocessFile(id: string, userId: string) {
    const file = await this.findById(id, userId);

    // Reset status back to PENDING and clear previous errors
    await db
      .update(files)
      .set({
        processingStatus: ProcessingStatus.PENDING,
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(files.id, id));

    const storagePath = path.join(this.uploadDir, this.storageBucket, file.storageKey);

    if (USE_BULLMQ_PROCESSING) {
      const attemptResult = await db
        .insert(fileProcessingAttempts)
        .values({
          fileId: file.id,
          queueJobId: `file-processing_${file.id}`, // temporarily using fileId
        })
        .returning({ id: fileProcessingAttempts.id });

      const attemptId = attemptResult[0].id;
      const queueJobId = `file-processing_${attemptId}`;
      await db.update(fileProcessingAttempts).set({ queueJobId }).where(eq(fileProcessingAttempts.id, attemptId));

      this.dispatcherService.dispatchAttempt(attemptId).catch((err) => {
        this.logger.error(`Failed to dispatch attempt ${attemptId}`, err);
      });
    } else {
      // Re-trigger background processing
      this.processFileBackground(file.id, storagePath, file.fileType as FileType, file.mimeType);
    }

    return { success: true, message: 'Reprocessing started' };
  }

  private createStorageKey(userId: string, originalName: string): string {
    const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    return `${userId}/${randomUUID()}${extension}`;
  }

  private hasUsableExtractedText(file: typeof files.$inferSelect): boolean {
    return file.processingStatus === ProcessingStatus.COMPLETED
      && !!file.extractedText?.trim()
      && !this.isSyntheticExtraction(file.extractedText);
  }

  private isSyntheticExtraction(text: string | null | undefined): boolean {
    return /mock extracted text|real production deployment|TEST_ONLY_DOCUMENT_EXTRACTION/i.test(text || '');
  }

  private toPublicFile(file: typeof files.$inferSelect) {
    const { storageKey, storageUrl, processingError, extractedText, metadata, ...publicFile } = file;
    const extractionStatus = metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).extractionStatus
      : undefined;
    const synthetic = this.isSyntheticExtraction(extractedText);
    const fallbackTitle = createInitialDocumentTitle(file.originalName);
    const title = getStoredDocumentTitle(metadata, file.originalName);
    const titleMetadata = metadata && typeof metadata === 'object'
      ? metadata as Record<string, unknown>
      : {};

    return {
      ...publicFile,
      title,
      titleSource: titleMetadata.documentTitleSource ?? fallbackTitle.documentTitleSource,
      titleConfirmed: titleMetadata.titleConfirmed === true,
      extractedText: synthetic ? null : extractedText,
      processingStatus: extractionStatus === 'ocr_required'
        ? ProcessingStatus.OCR_REQUIRED
        : synthetic ? ProcessingStatus.FAILED : file.processingStatus,
      extractionStatus,
      processingError: extractionStatus === 'ocr_required'
        ? 'OCR_REQUIRED'
        : file.processingStatus === ProcessingStatus.FAILED || synthetic
          ? 'PROCESSING_FAILED'
          : null,
    };
  }

  private parseByteRange(header: string | undefined, size: number): { start: number; end: number } | undefined {
    if (!header) return undefined;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
    if (!match || size <= 0) {
      throw new UnsatisfiableByteRangeException(size, 'Invalid byte range.');
    }

    const [, rawStart, rawEnd] = match;
    const suffixLength = rawStart === '' ? Number(rawEnd) : undefined;
    const start = suffixLength !== undefined
      ? Math.max(size - suffixLength, 0)
      : Number(rawStart);
    const end = rawStart === ''
      ? size - 1
      : rawEnd === '' ? size - 1 : Number(rawEnd);

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
      throw new UnsatisfiableByteRangeException(size);
    }
    return { start, end: Math.min(end, size - 1) };
  }

  private safeInlineFilename(originalName: string): string {
    return originalName.replace(/[\r\n"\\]/g, '_').slice(0, 180) || 'document.pdf';
  }

  private async isSuperAdmin(userId: string): Promise<boolean> {
    const userResult = await db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return false;
    }
    const user = userResult[0];
    const superAdminEmail = this.configService.get<string>('auth.superAdminEmail');
    const isSuperAdmin = !!(superAdminEmail && user.email.toLowerCase() === superAdminEmail.toLowerCase());
    return user.role === UserRole.ADMIN || isSuperAdmin;
  }

}
