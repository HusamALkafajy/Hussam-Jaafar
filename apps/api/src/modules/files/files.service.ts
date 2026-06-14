import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { db, users, files, subjects, subscriptions, eq, and, or, sql, desc } from '@studyai/database';

import { FileType, ProcessingStatus, UserRole } from '@studyai/types';
import { AiService } from '../ai/ai.service';
import { FileQueryDto } from './dto/file-query.dto';

import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private uploadDir = path.resolve(__dirname, '../../../../uploads');

  constructor(private readonly aiService: AiService) {
    this.ensureUploadDir();
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
    const bypassQuota = await this.isAdminOrHusam(userId);

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
    let fileType: FileType;
    const mime = expressFile.mimetype;

    if (mime === 'application/pdf') {
      fileType = FileType.PDF;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      fileType = FileType.DOCX;
    } else if (mime.startsWith('image/')) {
      fileType = FileType.IMAGE;
    } else {
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

    // 2. Generate unique storage key and paths
    const ext = path.extname(expressFile.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const storageKey = filename;
    const storagePath = path.join(this.uploadDir, filename);

    // 3. Save file locally
    await fs.writeFile(storagePath, expressFile.buffer);
    const storageUrl = `/uploads/${filename}`; // In production, this would be an S3/GCS URL

    // 4. Create database record as PENDING
    const result = await db
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

    const fileRecord = result[0];

    // Increment upload count inside subscription
    if (sub.length > 0) {
      await db
        .update(subscriptions)
        .set({ filesUsedThisMonth: sql`${subscriptions.filesUsedThisMonth} + 1` })
        .where(eq(subscriptions.id, sub[0].id));
    }


    // 5. Trigger background processing
    this.processFileBackground(fileRecord.id, storagePath, fileType, mime);

    return fileRecord;
  }

  private async processFileBackground(fileId: string, filePath: string, type: FileType, mime: string) {
    try {
      this.logger.log(`Background processing started for File ID: ${fileId}`);
      await db
        .update(files)
        .set({ processingStatus: ProcessingStatus.PROCESSING })
        .where(eq(files.id, fileId));

      let extractedText = '';

      if (type === FileType.PDF || type === FileType.IMAGE) {
        // Use Gemini API for PDFs and OCR images
        extractedText = await this.aiService.extractText(filePath, mime);
      } else if (type === FileType.DOCX) {
        // Use mammoth for Word files locally
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

      // Increment subject fileCount
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

      this.logger.log(`Background processing completed successfully for File ID: ${fileId}`);
    } catch (e: any) {
      this.logger.error(`Failed to process File ID: ${fileId}`, e);
      await db
        .update(files)
        .set({
          processingStatus: ProcessingStatus.FAILED,
          processingError: e.message || 'Unknown processing error',
        })
        .where(eq(files.id, fileId));
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
      data,
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

    // 1. Delete local file
    const storagePath = path.join(this.uploadDir, file.storageKey);
    try {
      await fs.unlink(storagePath);
    } catch (e) {
      this.logger.warn(`Failed to delete storage file ${storagePath}`, e);
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
    if (file.processingStatus !== ProcessingStatus.COMPLETED || !file.extractedText) {
      throw new BadRequestException('File is not processed yet');
    }
    return this.aiService.generateSummary(file.extractedText, level, language);
  }

  async generateExplanation(fileId: string, userId: string, level: string, language = 'en') {
    const file = await this.findById(fileId, userId);
    if (file.processingStatus !== ProcessingStatus.COMPLETED || !file.extractedText) {
      throw new BadRequestException('File is not processed yet');
    }
    return this.aiService.generateExplanation(file.extractedText, level, language);
  }

  async chatWithDocument(fileId: string, userId: string, question: string) {
    const file = await this.findById(fileId, userId);
    if (file.processingStatus !== ProcessingStatus.COMPLETED || !file.extractedText) {
      throw new BadRequestException('File is not processed yet');
    }

    const bypassQuota = await this.isAdminOrHusam(userId);

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

    const chatResult = await this.aiService.chatWithDocument(file.extractedText, question, []);

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
      case '.doc':
        return 'application/msword';
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
    const bypassQuota = await this.isAdminOrHusam(userId);

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

    let fileType: FileType;
    if (mime === 'application/pdf') {
      fileType = FileType.PDF;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      fileType = FileType.DOCX;
    } else if (mime.startsWith('image/')) {
      fileType = FileType.IMAGE;
    } else {
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

    const filename = path.basename(filePath);
    const storageKey = filename;
    const storageUrl = `/uploads/${filename}`;

    // Create database record as PENDING
    const result = await db
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

    const fileRecord = result[0];

    // Increment upload count inside subscription
    if (sub.length > 0) {
      await db
        .update(subscriptions)
        .set({ filesUsedThisMonth: sql`${subscriptions.filesUsedThisMonth} + 1` })
        .where(eq(subscriptions.id, sub[0].id));
    }

    // Trigger background processing
    this.processFileBackground(fileRecord.id, filePath, fileType, mime);

    return fileRecord;
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

    const storagePath = path.join(this.uploadDir, file.storageKey);

    // Re-trigger background processing
    this.processFileBackground(file.id, storagePath, file.fileType as FileType, file.mimeType);

    return { success: true, message: 'Reprocessing started' };
  }

  private async isAdminOrHusam(userId: string): Promise<boolean> {
    const userResult = await db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return false;
    }
    const user = userResult[0];
    return user.role === UserRole.ADMIN || user.email === 'husamjfr@gmail.com';
  }

}

