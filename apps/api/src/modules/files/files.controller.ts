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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileQueryDto } from './dto/file-query.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { CreateSubjectDto, UpdateSubjectDto, AssignSubjectDto } from '@studyai/types';
import { FileMagicValidationPipe } from '../../common/pipes/file-magic-validation.pipe';

@Controller()
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ── Files Endpoints ──

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser('sub') userId: string,
    @UploadedFile(new FileMagicValidationPipe())
    file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    return this.filesService.createFile(userId, file, dto.subjectId);
  }

  @Post('files/upload/chunk')
  @UseInterceptors(FileInterceptor('file'))
  async uploadChunk(
    @CurrentUser('sub') userId: string,
    @UploadedFile(new FileMagicValidationPipe())
    file: Express.Multer.File,
    @Body('uploadId') uploadId: string,
    @Body('chunkIndex') chunkIndex: string,
    @Body('totalChunks') totalChunks: string,
    @Body('filename') filename: string,
    @Body('subjectId') subjectId?: string,
  ) {
    return this.filesService.handleChunkUpload(
      userId,
      file.buffer,
      uploadId,
      parseInt(chunkIndex, 10),
      parseInt(totalChunks, 10),
      filename,
      subjectId,
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
    return this.filesService.findById(id, userId);
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

  // ── Subjects Endpoints ──


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
