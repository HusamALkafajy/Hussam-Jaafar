import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { db, notes, eq, and, desc } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { GamificationService } from '../study-coach/gamification.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly gamificationService: GamificationService,
  ) {}

  /** Create a new note. fileId is optional (standalone notes allowed). */
  async create(userId: string, dto: CreateNoteDto) {
    const result = await db
      .insert(notes)
      .values({
        userId,
        fileId: dto.fileId ?? null,
        title: dto.title || 'Untitled Note',
        content: dto.content || '',
        color: dto.color || 'default',
      })
      .returning();

    const note = result[0];

    // Award gamification challenge progress for note creation (fire-and-forget)
    this.gamificationService
      .updateChallengeProgress(userId, 'note', 1)
      .catch((err) => this.logger.warn('Challenge progress update failed:', err));

    return note;
  }

  /** List all notes for a user. Supports optional fileId filter. */
  async findAll(userId: string, fileId?: string) {
    const conditions = [eq(notes.userId, userId)];
    if (fileId) {
      conditions.push(eq(notes.fileId, fileId));
    }

    return db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt));
  }

  /** Get a single note by ID, verifying ownership. */
  async findById(id: string, userId: string) {
    const result = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Note not found');
    }

    return result[0];
  }

  /** Update note content, title, color, or pin state. */
  async update(id: string, userId: string, dto: UpdateNoteDto) {
    await this.findById(id, userId); // ownership check

    const updated = await db
      .update(notes)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    return updated[0];
  }

  /** Delete a note. */
  async remove(id: string, userId: string) {
    await this.findById(id, userId); // ownership check

    await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)));

    return { success: true };
  }

  /**
   * Trigger AI analysis on a note:
   * - Generates a 2-3 sentence summary
   * - Generates up to 5 quiz questions
   * Persists results and timestamps lastAnalyzedAt.
   * Strictly manual — never called on auto-save.
   */
  async analyze(id: string, userId: string) {
    const note = await this.findById(id, userId);

    if (!note.content || note.content.trim().length < 20) {
      throw new ForbiddenException('Note content is too short to analyze. Add more content first.');
    }

    this.logger.log(`Analyzing note ${id} for user ${userId}`);

    const [summaryResult, quizQuestions] = await Promise.all([
      this.aiService.generateNoteSummary(note.content),
      this.aiService.generateNoteQuizQuestions(note.content),
    ]);

    const updated = await db
      .update(notes)
      .set({
        aiSummary: summaryResult.summary,
        quizQuestions,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    return updated[0];
  }
}
