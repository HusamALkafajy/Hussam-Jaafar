import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
  Res,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';
import { FilesService, UnsatisfiableByteRangeException } from './files.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileQueryDto } from './dto/file-query.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { CreateSubjectDto, UpdateSubjectDto, AssignSubjectDto } from '@studyai/types';
import { FileMagicValidationPipe } from '../../common/pipes/file-magic-validation.pipe';
import { Response } from 'express';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_CHUNK_BYTES,
  UploadErrorCode,
  UploadException,
} from '../../common/files/upload-contract';

const directUploadDirectory = resolve(process.cwd(), 'apps/api/uploads/temp/direct');
const directUploadOptions = {
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      mkdirSync(directUploadDirectory, { recursive: true });
      callback(null, directUploadDirectory);
    },
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  // Multer emits LIMIT_FILE_SIZE when the stream reaches its configured
  // boundary. Give transport parsing one byte of headroom; the upload
  // contract performs the authoritative inclusive 50 MiB check.
  limits: { fileSize: MAX_UPLOAD_BYTES + 1, files: 1 },
};

const chunkUploadOptions = {
  limits: { fileSize: UPLOAD_CHUNK_BYTES + 1, files: 1 },
};

@Controller()
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // â”€â”€ Files Endpoints â”€â”€

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', directUploadOptions))
  async uploadFile(
    @CurrentUser('sub') userId: string,
    @UploadedFile(new FileMagicValidationPipe())
    file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    return this.filesService.createFile(userId, file, dto.subjectId, dto.title);
  }

  @Post('files/upload/chunk')
  @UseInterceptors(FileInterceptor('file', chunkUploadOptions))
  async uploadChunk(
    @CurrentUser('sub') userId: string,
    @UploadedFile()
    file: Express.Multer.File,
    @Body('uploadId') uploadId: string,
    @Body('chunkIndex') chunkIndex: string,
    @Body('totalChunks') totalChunks: string,
    @Body('filename') filename: string,
    @Body('fileSize') fileSize: string,
    @Body('mimeType') mimeType: string,
    @Body('title') title?: string,
    @Body('subjectId') subjectId?: string,
  ) {
    if (!file?.buffer) {
      throw new UploadException(UploadErrorCode.INVALID_UPLOAD, 'No upload chunk was provided.');
    }
    return this.filesService.handleChunkUpload(
      userId,
      file.buffer,
      uploadId,
      parseInt(chunkIndex, 10),
      parseInt(totalChunks, 10),
      filename,
      Number(fileSize),
      mimeType,
      subjectId,
      title,
    );
  }

  @Get('files')
  async getFiles(@CurrentUser('sub') userId: string, @Query() query: FileQueryDto) {
    return this.filesService.findAll(userId, query);
  }

  @Get('files/search')
  async searchFiles(@CurrentUser('sub') userId: string, @Query('q') q: string) {
    return this.filesService.search(userId, q);
  }

  @Get('files/:id')
  async getFile(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.filesService.getPublicFileById(id, userId);
  }

  @Get('files/:id/original')
  async streamOriginalFile(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() response: Response,
  ) {
    let original;
    try {
      original = await this.filesService.openOriginalFile(id, userId, rangeHeader);
    } catch (error) {
      if (error instanceof UnsatisfiableByteRangeException) {
        response.status(416);
        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Content-Range', `bytes */${error.completeLength}`);
        response.setHeader('Content-Length', '0');
        response.end();
        return;
      }
      throw error;
    }
    const { stream, fileName, mimeType, size, range } = original;
    const length = range ? range.end - range.start + 1 : size;

    response.status(range ? 206 : 200);
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Length', String(length));
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (range) response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);

    stream.on('error', () => {
      if (!response.headersSent) response.status(404);
      response.end();
    });
    stream.pipe(response);
  }

  @Delete('files/:id')
  async deleteFile(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.filesService.deleteFile(id, userId);
    return { message: 'File deleted successfully' };
  }

  @Post('files/:id/reprocess')
  async reprocessFile(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.filesService.reprocessFile(id, userId);
  }

  @Patch('files/:id/subject')
  async assignSubject(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AssignSubjectDto,
  ) {
    return this.filesService.assignSubject(id, dto.subjectId || null, userId);
  }

  @Post('files/:id/summary-stream')
  @Sse()
  async generateSummaryStream(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('level') level: string,
    @Body('language') language?: string,
  ): Promise<Observable<MessageEvent>> {
    return this.filesService.generateSummaryStream(id, userId, level, language);
  }

  @Post('files/:id/chat-stream')
  @Sse()
  async chatWithDocumentStream(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ): Promise<Observable<MessageEvent>> {
    return this.filesService.chatWithDocumentStream(id, userId, content);
  }

  @Post('files/:id/summary')
  async generateSummary(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('level') level: string,
    @Body('language') language?: string,
  ) {
    return this.filesService.generateSummary(id, userId, level, language);
  }

  @Post('files/:id/explain')
  async generateExplanation(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('level') level: string,
    @Body('language') language?: string,
  ) {
    return this.filesService.generateExplanation(id, userId, level, language);
  }

  @Post('files/:id/chat')
  async chatWithDocument(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.filesService.chatWithDocument(id, userId, content);
  }

  // â”€â”€ Subjects Endpoints â”€â”€


  @Post('subjects')
  async createSubject(@CurrentUser('sub') userId: string, @Body() dto: CreateSubjectDto) {
    return this.filesService.createSubject(userId, dto);
  }

  @Get('subjects')
  async getSubjects(@CurrentUser('sub') userId: string) {
    return this.filesService.findSubjects(userId);
  }

  @Patch('subjects/:id')
  async updateSubject(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.filesService.updateSubject(id, userId, dto);
  }

  @Delete('subjects/:id')
  async deleteSubject(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.filesService.deleteSubject(id, userId);
    return { message: 'Subject deleted successfully' };
  }
}
