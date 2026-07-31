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
import * as path from 'path';
import * as mammoth from 'mammoth';
import { ConfigService } from '@nestjs/config';
import { IStorageProvider } from '@studyai/infrastructure';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

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
  ) {
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
        throw new ForbiddenException('Monthly file upload limit exceeded (SaaS Quota)');
      }
    }

    // 1. Determine file type
    const mime = expressFile.mimetype;
    const fileType = CANONICAL_UPLOAD_FORMATS[mime];

    if (!fileType) {
      throw new BadRequestException('Unsupported file type');
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

    // 2. Persist the original through the configured storage boundary. The key
    // is stable and opaque; it is neither a public URL nor a filesystem path.
    const storageKey = this.createStorageKey(userId, expressFile.originalname);
    await this.storageProvider.upload(
      this.storageBucket,
      storageKey,
      Readable.from(expressFile.buffer),
      { contentType: mime, contentLength: expressFile.size },
    );
    const storageUrl = 'private://document';

    // 4. Create database record as PENDING
    let result;
    try {
      result = await db
        .insert(files)
        .values({
          userId,
          subjectId: subjectId || null,
          originalName: expressFile.originalname,
          storageKey,
          storageUrl,
          fileType,
          mimeType: mime,
          fileSize: expressFile.size,
          processingStatus: ProcessingStatus.PENDING,
        })
        .returning();
    } catch (error) {
      await this.storageProvider.delete(this.storageBucket, storageKey).catch(() => undefined);
      throw error;
    }

    const fileRecord = result[0];

    // Increment upload count inside subscription
    if (sub.length > 0) {
      await db
        .update(subscriptions)
        .set({ filesUsedThisMonth: sql`${subscriptions.filesUsedThisMonth} + 1` })
        .where(eq(subscriptions.id, sub[0].id));
    }


    // 5. Trigger background processing
    if (USE_BULLMQ_PROCESSING) {
      const attemptResult = await db
        .insert(fileProcessingAttempts)
        .values({
          fileId: fileRecord.id,
          queueJobId: `file-processing_${fileRecord.id}`, // temporarily using fileId for predictable format until attempt uuid is generated
        })
        .returning({ id: fileProcessingAttempts.id });

      const attemptId = attemptResult[0].id;
      const queueJobId = `file-processing_${attemptId}`;
      await db.update(fileProcessingAttempts).set({ queueJobId }).where(eq(fileProcessingAttempts.id, attemptId));

      this.dispatcherService.dispatchAttempt(attemptId).catch((err) => {
        this.logger.error(`Failed to dispatch attempt ${attemptId}`, err);
      });
    } else {
      // (fire-and-forget with explicit error handling)
      this.processFileBackground(fileRecord.id, path.join(this.uploadDir, this.storageBucket, storageKey), fileType, mime)
        .catch((err) => {
          this.logger.error(
            `[FilesService] Unhandled top-level error in processFileBackground for file ${fileRecord.id}. ` +
            `Marking as FAILED. Error: ${err?.message || err}`,
          );
          db.update(files)
            .set({
              processingStatus: ProcessingStatus.FAILED,
              processingError: `Internal processing error: ${err?.message || 'Unknown'}`,
            })
            .where(eq(files.id, fileRecord.id))
            .catch((dbErr) =>
              this.logger.error(`Failed to write FAILED status for file ${fileRecord.id}:`, dbErr),
            );
        });
    }

    // Award gamification challenge progress for file upload (fire-and-forget)
    this.gamificationService
      .updateChallengeProgress(userId, 'upload', 1)
      .catch((err) => this.logger.warn('Challenge progress update failed:', err));

    return this.toPublicFile(fileRecord);
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
      conditions.push(sql`${files.originalName} ILIKE ${`%${query.search}%`}`);
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
    return db
      .select({
        id: files.id,
        originalName: files.originalName,
        fileType: files.fileType,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          or(
            sql`${files.originalName} ILIKE ${`%${q}%`}`,
            sql`${files.extractedText} ILIKE ${`%${q}%`}`,
          ),
        ),
      )
      .limit(20);
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
    subjectId?: string,
  ) {
    const tempDir = path.join(this.uploadDir, 'temp', uploadId);
    await fs.mkdir(tempDir, { recursive: true });

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    await fs.writeFile(chunkPath, chunkBuffer);

    // If it is the last chunk, merge all of them sequentially
    if (chunkIndex === totalChunks - 1) {
      const ext = path.extname(filename);
      const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const finalPath = path.join(this.uploadDir, uniqueFilename);

      // Create empty file
      await fs.writeFile(finalPath, '');

      // Append chunks sequentially to preserve order
      for (let i = 0; i < totalChunks; i++) {
        const currentChunkPath = path.join(tempDir, `chunk_${i}`);
        try {
          const chunkData = await fs.readFile(currentChunkPath);
          await fs.appendFile(finalPath, chunkData);
        } catch (err) {
          throw new BadRequestException(`Failed to merge chunk ${i}: ${err.message}`);
        }
      }

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

      // Register file in database and start AI processing
      const mime = this.getMimeTypeFromExtension(ext);
      const finalSize = (await fs.stat(finalPath)).size;

      return this.registerAndProcessFile(
        userId,
        finalPath,
        filename,
        mime,
        finalSize,
        subjectId,
      );
    }

    return { success: true, message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded` };
  }

  private getMimeTypeFromExtension(ext: string): string {
    switch (ext.toLowerCase()) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  async registerAndProcessFile(
    userId: string,
    filePath: string,
    originalname: string,
    mime: string,
    size: number,
    subjectId?: string,
  ) {
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
        // Clean up the merged file
        await fs.unlink(filePath).catch(() => {});
        throw new ForbiddenException('Monthly file upload limit exceeded (SaaS Quota)');
      }
    }

    // Determine file type
    const fileType = CANONICAL_UPLOAD_FORMATS[mime];
    if (!fileType) {
      await fs.unlink(filePath).catch(() => {});
      throw new BadRequestException('Unsupported file type');
    }

    // Validate subject if provided
    if (subjectId) {
      const subject = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
        .limit(1);
      if (subject.length === 0) {
        await fs.unlink(filePath).catch(() => {});
        throw new NotFoundException('Subject not found');
      }
    }

    const storageKey = this.createStorageKey(userId, originalname);
    const storageUrl = 'private://document';
    const fileBuffer = await fs.readFile(filePath);
    await this.storageProvider.upload(
      this.storageBucket,
      storageKey,
      Readable.from(fileBuffer),
      { contentType: mime, contentLength: size },
    );
    await fs.unlink(filePath).catch(() => undefined);

    // Create database record as PENDING
    let result;
    try {
      result = await db
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
          processingStatus: ProcessingStatus.PENDING,
        })
        .returning();
    } catch (error) {
      await this.storageProvider.delete(this.storageBucket, storageKey).catch(() => undefined);
      throw error;
    }

    const fileRecord = result[0];

    // Increment upload count inside subscription
    if (sub.length > 0) {
      await db
        .update(subscriptions)
        .set({ filesUsedThisMonth: sql`${subscriptions.filesUsedThisMonth} + 1` })
        .where(eq(subscriptions.id, sub[0].id));
    }

    if (USE_BULLMQ_PROCESSING) {
      // Create file processing attempt
      const attemptResult = await db
        .insert(fileProcessingAttempts)
        .values({
          fileId: fileRecord.id,
          queueJobId: `file-processing_${fileRecord.id}`, // temporarily using fileId for predictable format until attempt uuid is generated, actually we can generate attemptId first
        })
        .returning({ id: fileProcessingAttempts.id });

      const attemptId = attemptResult[0].id;
      // Re-update queueJobId to include attemptId
      const queueJobId = `file-processing_${attemptId}`;
      await db.update(fileProcessingAttempts).set({ queueJobId }).where(eq(fileProcessingAttempts.id, attemptId));

      // Trigger dispatcher
      this.dispatcherService.dispatchAttempt(attemptId).catch((err) => {
        this.logger.error(`Failed to dispatch attempt ${attemptId}`, err);
      });
    } else {
      // Trigger background processing (fire-and-forget with explicit error handling)
      this.processFileBackground(fileRecord.id, path.join(this.uploadDir, this.storageBucket, storageKey), fileType, mime)
        .catch((err) => {
          this.logger.error(
            `[FilesService] Unhandled top-level error in processFileBackground (chunked) for file ${fileRecord.id}. ` +
            `Marking as FAILED. Error: ${err?.message || err}`,
          );
          db.update(files)
            .set({
              processingStatus: ProcessingStatus.FAILED,
              processingError: `Internal processing error: ${err?.message || 'Unknown'}`,
            })
            .where(eq(files.id, fileRecord.id))
            .catch((dbErr) =>
              this.logger.error(`Failed to write FAILED status for file ${fileRecord.id}:`, dbErr),
            );
        });
    }

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

    return {
      ...publicFile,
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
      throw new HttpException('Invalid byte range.', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
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
      throw new HttpException('Requested range is not satisfiable.', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
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
