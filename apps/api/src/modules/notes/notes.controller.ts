import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** POST /notes — create a note (fileId optional) */
  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(userId, dto);
  }

  /** GET /notes?fileId=<uuid> — list all user notes, optionally filtered by document */
  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('fileId') fileId?: string,
  ) {
    return this.notesService.findAll(userId, fileId);
  }

  /** GET /notes/:id — get single note with AI content */
  @Get(':id')
  findOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notesService.findById(id, userId);
  }

  /** PATCH /notes/:id — update title, content, color, pinned */
  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(id, userId, dto);
  }

  /** DELETE /notes/:id */
  @Delete(':id')
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notesService.remove(id, userId);
  }

  /**
   * POST /notes/:id/analyze
   * Manually trigger AI summary + quiz generation.
   * Never called on auto-save — user must click the "Analyze" button.
   */
  @Post(':id/analyze')
  analyze(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notesService.analyze(id, userId);
  }
}
