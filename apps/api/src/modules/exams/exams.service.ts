import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { db, exams, questions, files, eq, and, or, desc, sql, isNull, lt, inArray } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { RagService } from '../rag/rag.service';
import { GamificationService } from '../study-coach/gamification.service';
import { DocumentReadService } from '../document-read/document-read.service';
import { QuizMonthlyCapacityService } from '../quota/quiz-monthly-capacity.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { Difficulty, QuestionType } from '@studyai/types';
import {
  evaluateReleaseAttemptEligibility,
  INVALID_RELEASE_EXAM_MESSAGE,
  isGeneratedReleaseMcqQuestion,
  RELEASE_QUESTION_TYPE_MESSAGE,
} from './exam-release-eligibility';

const INVALID_GENERATED_QUESTIONS_MESSAGE =
  'Generated exam contains unsupported or invalid questions. Try again.';

export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly gamificationService: GamificationService,
    private readonly documentReadService: DocumentReadService,
    private readonly quizMonthlyCapacityService: QuizMonthlyCapacityService,
  ) {}

  async create(userId: string, dto: CreateExamDto) {
    const file = await this.filesService.findById(dto.fileId, userId);
    if (!file.extractedText) {
      throw new BadRequestException('File extracted text is missing. Re-upload or re-analyze.');
    }

    if (
      !Array.isArray(dto.questionTypes) ||
      dto.questionTypes.length === 0 ||
      dto.questionTypes.some((type) => type !== QuestionType.MCQ)
    ) {
      throw new BadRequestException(RELEASE_QUESTION_TYPE_MESSAGE);
    }

    const admission = await this.quizMonthlyCapacityService.tryConsumeQuizCapacity(
      userId,
      dto.totalQuestions,
    );
    if (!admission.admitted) {
      throw new TooManyRequestsException('Monthly quiz question limit exceeded.');
    }

    // 1. Generate questions using the configured AI provider
    const generated = await this.aiService.generateExam(
      file.extractedText,
      dto.difficulty,
      dto.questionTypes,
      dto.totalQuestions,
    );

    if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
      throw new BadRequestException(INVALID_GENERATED_QUESTIONS_MESSAGE);
    }

    if (!Array.isArray(generated.questions)) {
      throw new BadRequestException(INVALID_GENERATED_QUESTIONS_MESSAGE);
    }

    if (generated.questions.length === 0) {
      throw new BadRequestException('Failed to generate questions. Try again.');
    }

    this.validateGeneratedQuestions(generated.questions, dto.difficulty);
    const title = generated.title || `اختبار: ${file.originalName}`;
    const generatedQuestions = generated.questions.slice(0, dto.totalQuestions);

    // 2. Save Exam
    const examResult = await db
      .insert(exams)
      .values({
        fileId: file.id,
        userId,
        title,
        difficulty: dto.difficulty,
        totalQuestions: generatedQuestions.length,
        timeLimitMinutes: dto.timeLimitMinutes || null,
        status: 'active',
        startedAt: new Date(),
        adaptiveMode: false,
      })
      .returning();

    const exam = examResult[0];

    // 3. Save Questions
    const questionValues = generatedQuestions.map((q: any, index: number) => ({
      examId: exam.id,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer.trim(),
      difficulty: q.difficulty ?? dto.difficulty,
      orderIndex: index,
      points: q.points ?? 1,
      explanation: q.explanation ?? null,
    }));

    await db.insert(questions).values(questionValues);

    return this.findById(exam.id, userId);
  }

  private validateGeneratedQuestions(generatedQuestions: unknown[], dtoDifficulty: Difficulty): void {
    for (const candidate of generatedQuestions) {
      if (!isGeneratedReleaseMcqQuestion(candidate, dtoDifficulty)) {
        throw new BadRequestException(INVALID_GENERATED_QUESTIONS_MESSAGE);
      }
    }
  }

  async findAll(userId: string) {
    const userExams = await db
      .select()
      .from(exams)
      .where(eq(exams.userId, userId))
      .orderBy(desc(exams.createdAt));

    if (userExams.length === 0) {
      return [];
    }

    const eligibilityQuestions = await db
      .select({
        examId: questions.examId,
        type: questions.type,
        questionText: questions.questionText,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        difficulty: questions.difficulty,
        points: questions.points,
      })
      .from(questions)
      .where(inArray(questions.examId, userExams.map((exam) => exam.id)));

    const questionsByExam = new Map<string, typeof eligibilityQuestions>();
    for (const question of eligibilityQuestions) {
      const examQuestions = questionsByExam.get(question.examId) ?? [];
      examQuestions.push(question);
      questionsByExam.set(question.examId, examQuestions);
    }

    return userExams.map((exam) => ({
      ...exam,
      attemptEligible: evaluateReleaseAttemptEligibility({
        status: exam.status,
        questions: questionsByExam.get(exam.id) ?? [],
      }).eligible,
    }));
  }

  async findById(id: string, userId: string) {
    const examResult = await db
      .select()
      .from(exams)
      .where(and(eq(exams.id, id), eq(exams.userId, userId)))
      .limit(1);

    if (examResult.length === 0) {
      throw new NotFoundException('Exam not found');
    }

    const exam = examResult[0];

    const examQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, exam.id))
      .orderBy(questions.orderIndex);

    return {
      ...exam,
      questions: examQuestions,
      attemptEligible: evaluateReleaseAttemptEligibility({
        status: exam.status,
        questions: examQuestions,
      }).eligible,
    };
  }

  async submit(id: string, userId: string, dto: SubmitExamDto) {
    // =========================================================================
    // PHASE 1: ATOMIC CLAIM + ANSWER DURABILITY TRANSACTION
    //
    // PR1.2 Batch 2 — Evaluation Concurrency Hardening
    //
    // This short transaction atomically acquires evaluation ownership before any
    // external work begins. A conditional UPDATE increments evaluation_version
    // (the fencing token) and sets evaluation_locked_at in one atomic statement.
    //
    // The claim and submitted-answer persistence share the same transaction so:
    //   - A failed claim produces zero answer writes.
    //   - A successful claim always produces durable answers.
    //   - No concurrent request can mutate answers while the lock is held.
    //
    // The LLM, RAG, and gamification are intentionally OUTSIDE this transaction.
    // =========================================================================

    /** Stale lock threshold: 5 minutes. Conservative given AI calls average 10–45s. */
    const STALE_LEASE_MS = 5 * 60 * 1000;

    // Pre-flight: read current exam state for user-facing error differentiation.
    // This SELECT is intentionally BEFORE the transaction. It is NOT the
    // authoritative eligibility check — the conditional UPDATE below is.
    // We use it only to return a more informative error message.
    const examData = await this.findById(id, userId);

    if (examData.status === 'completed') {
      throw new BadRequestException('Exam has already been submitted');
    }

    // Phase 1: Atomic claim + answer persistence in one short transaction.
    let claimedVersion: number;
    try {
      claimedVersion = await db.transaction(async (tx) => {
        // Lock the exact rows used for eligibility and answer persistence so a
        // direct API submission cannot race the release-contract decision.
        const lockedExamResult = await tx
          .select()
          .from(exams)
          .where(and(eq(exams.id, id), eq(exams.userId, userId)))
          .for('update')
          .limit(1);

        if (lockedExamResult.length === 0) {
          throw new NotFoundException('Exam not found');
        }

        const lockedExam = lockedExamResult[0];
        if (lockedExam.status === 'completed') {
          if (examData.status === 'active') {
            throw new ConflictException(
              'Exam evaluation was completed by a concurrent request.',
            );
          }
          throw new BadRequestException('Exam has already been submitted');
        }
        if (lockedExam.status !== 'active') {
          throw new BadRequestException('Exam is not active');
        }

        const lockedQuestions = await tx
          .select()
          .from(questions)
          .where(eq(questions.examId, id))
          .orderBy(questions.orderIndex)
          .for('update');

        const eligibility = evaluateReleaseAttemptEligibility({
          status: lockedExam.status,
          questions: lockedQuestions,
        });
        if (!eligibility.eligible) {
          throw new BadRequestException(
            eligibility.reason === 'UNSUPPORTED_QUESTION_TYPE'
              ? RELEASE_QUESTION_TYPE_MESSAGE
              : INVALID_RELEASE_EXAM_MESSAGE,
          );
        }

        // ── Step 1: Conditional atomic claim ──────────────────────────────────
        // This single UPDATE is the authoritative eligibility and ownership gate.
        // It succeeds only if:
        //   (a) exam belongs to the requesting user,
        //   (b) exam status is 'active',
        //   (c) no valid (non-stale) lock is held.
        //
        // On success: evaluation_version is atomically incremented and returned.
        // This new version is the worker's immutable fencing token for all
        // subsequent writes. No other concurrent request can obtain the same token.
        const staleThreshold = new Date(Date.now() - STALE_LEASE_MS);

        const claimResult = await tx
          .update(exams)
          .set({
            evaluationVersion: sql`${exams.evaluationVersion} + 1`,
            evaluationLockedAt: new Date(),
          })
          .where(
            and(
              eq(exams.id, id),
              eq(exams.userId, userId),
              eq(exams.status, 'active'),
              or(
                isNull(exams.evaluationLockedAt),
                lt(exams.evaluationLockedAt, staleThreshold),
              ),
            ),
          )
          .returning({ version: exams.evaluationVersion });

        if (claimResult.length === 0) {
          // Claim failed. Another evaluation is currently in progress.
          // The pre-flight check above already ruled out 'completed', so
          // a zero-row result here means a concurrent worker holds a valid lock.
          throw new ConflictException('Exam evaluation is already in progress. Please wait and try again.');
        }

        const newVersion = claimResult[0].version;

        // ── Step 2: Persist submitted answers under the lock ──────────────────
        // Answers are written here and only here. Because we hold the lock,
        // no concurrent request can claim the evaluation (and thus no other
        // request can write answers). Answers become immutable for the duration
        // of the evaluation lease.
        for (const q of lockedQuestions) {
          const submission = dto.answers.find((a) => a.questionId === q.id);
          const userAnswer = submission ? submission.userAnswer.trim() : '';

          let isCorrect = false;
          if (q.type === 'mcq' || q.type === 'true_false' || q.type === 'fill_blank') {
            isCorrect = q.correctAnswer.toLowerCase() === userAnswer.toLowerCase();
          }
          // Essays/short-answer: isCorrect remains false here; AI feedback below may revise.

          await tx
            .update(questions)
            .set({ userAnswer, isCorrect, answeredAt: new Date() })
            .where(eq(questions.id, q.id));
        }

        return newVersion;
      });
    } catch (err) {
      // Re-throw ConflictException and BadRequestException as-is.
      // All other transaction errors surface as internal failures.
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Claim transaction failed for exam ${id}:`, err);
      throw err;
    }

    // =========================================================================
    // PHASE 2: IN-MEMORY EVALUATION (OUTSIDE ANY TRANSACTION)
    //
    // The evaluation lock is now held. All AI, RAG, and scoring work occurs
    // entirely in-memory. No authoritative evaluation results are written to the
    // database during this phase.
    //
    // Design rationale:
    //   - Long-running transactions starve the DB connection pool and hold row
    //     locks across network round-trips, causing cascading failures.
    //   - Intermediate writes during evaluation create the unfenced child-row
    //     corruption problem identified in the PR1.2 adversarial review.
    //   - Buffering all results in memory and flushing them in one final
    //     transaction is the smallest correct architecture.
    //
    // If this process crashes here, the evaluation_locked_at lease will expire
    // after STALE_LEASE_MS, at which point the user may retry and a new worker
    // will reclaim ownership. The submitted answers are already durable (Phase 1).
    // =========================================================================

    // Re-read questions from DB to get the durable answers written in Phase 1.
    const examQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, id))
      .orderBy(questions.orderIndex);

    // ── 2a. Local grading ────────────────────────────────────────────────────
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    /**
     * In-memory buffer for per-question evaluation results.
     * No DB writes until Phase 3 Final Fenced Commit.
     */
    const questionResults: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      points: number;
    }> = [];

    for (const q of examQuestions) {
      totalPoints += q.points;
      const userAnswer = q.userAnswer ?? '';
      const isCorrect = q.isCorrect ?? false;

      if (isCorrect) {
        correctCount++;
        earnedPoints += q.points;
      }

      questionResults.push({
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.type,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        points: q.points,
      });
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    // ── 2b. RAG context retrieval ────────────────────────────────────────────
    this.logger.log(`Generating RAG context for exam ${id} feedback...`);
    const wrongResults = questionResults.filter((r) => !r.isCorrect);
    const ragContextParts: string[] = [];

    for (const wrong of wrongResults.slice(0, 5)) {
      try {
        // Resolve active version
        const { versionId } = await this.documentReadService.resolveActiveReadableVersion(examData.fileId, userId);
        if (versionId) {
          const chunks = await this.ragService.searchChunks(
            versionId,
            wrong.questionText,
            3,
          );
          if (chunks.length > 0) {
            ragContextParts.push(
              `[Context for: "${wrong.questionText}"]\n` +
                chunks.map((c) => `Page ${c.pageNumber}: ${c.content}`).join('\n'),
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to get RAG context for question ${wrong.questionId}:`, err);
      }
    }

    const ragContext = ragContextParts.join('\n\n---\n\n');

    // ── 2c. LLM evaluation ───────────────────────────────────────────────────
    // The existing AI fallback behavior is preserved exactly.
    // If the LLM throws, a fallback payload is produced and the flow continues
    // through Phase 3 normally. The exam will never be permanently stranded by
    // a transient LLM failure.
    this.logger.log(`Calling AI for exam feedback on exam ${id}...`);
    let aiFeedbackResult: any;
    try {
      aiFeedbackResult = await this.aiService.generateExamFeedback(
        questionResults,
        ragContext,
        score,
      );
    } catch (err) {
      this.logger.error('AI feedback generation failed, using fallback:', err);
      aiFeedbackResult = {
        strengthAnalysis: { topics: [], description: 'تحليل الأداء غير متاح حالياً.' },
        weaknessAnalysis: { topics: [], weakTopics: [], description: 'تحليل الأداء غير متاح حالياً.' },
        studyPlan: { steps: ['مراجعة المواد الدراسية.'], recommendations: [] },
        perQuestionFeedback: [],
      };
    }

    /**
     * In-memory buffer for per-question AI feedback.
     * Maps questionId → feedback string.
     * Written to the database only during Phase 3.
     */
    const feedbackBuffer = new Map<string, { aiFeedback: string; isCorrect?: boolean }>();

    if (aiFeedbackResult.perQuestionFeedback?.length > 0) {
      for (const qFeedback of aiFeedbackResult.perQuestionFeedback) {
        const feedbackText = [qFeedback.feedback, qFeedback.miniLesson]
          .filter(Boolean)
          .join('\n\n');
        feedbackBuffer.set(qFeedback.questionId, {
          aiFeedback: feedbackText,
          // AI may override isCorrect for essay/short-answer questions
          ...(typeof qFeedback.isCorrect === 'boolean' ? { isCorrect: qFeedback.isCorrect } : {}),
        });
      }
    }

    // =========================================================================
    // PHASE 3: FINAL FENCED COMMIT TRANSACTION
    //
    // This transaction begins by verifying that this worker still owns the
    // evaluation slot via the exact fencing token (claimedVersion).
    //
    // The fencing gate is the FIRST statement in the transaction. It:
    //   1. Updates the exams row, proving ownership via evaluationVersion.
    //   2. Writes final exam state (score, status, analysis).
    //   3. Clears the evaluation lock.
    //
    // If zero rows are returned from the fencing gate:
    //   - A stale worker has been preempted.
    //   - The transaction rolls back immediately.
    //   - ZERO question rows are written by this worker.
    //
    // After the fencing gate succeeds, all buffered question feedback is flushed
    // within the same transaction, guaranteeing atomic consistency between the
    // exam row and its child question rows.
    // =========================================================================

    try {
      await db.transaction(async (tx) => {
        // ── Step 1: Fencing gate (MUST be first statement in transaction) ─────
        // Verifies ownership and writes final exam state atomically.
        // The WHERE clause is the fence: evaluationVersion must match exactly.
        // A stale worker holds an old claimedVersion; the DB row now has a
        // higher version, so it returns 0 rows and the transaction aborts.
        const examFinalUpdate = await tx
          .update(exams)
          .set({
            status: 'completed',
            completedAt: new Date(),
            score: score.toFixed(2),
            strengthAnalysis: aiFeedbackResult.strengthAnalysis,
            weaknessAnalysis: aiFeedbackResult.weaknessAnalysis,
            studyPlan: aiFeedbackResult.studyPlan,
            evaluationLockedAt: null, // Clear the evaluation lock on successful completion
          })
          .where(
            and(
              eq(exams.id, id),
              eq(exams.evaluationVersion, claimedVersion), // THE FENCING TOKEN
              eq(exams.status, 'active'),                  // Guard against double-completion
            ),
          )
          .returning({ id: exams.id });

        if (examFinalUpdate.length === 0) {
          // This worker has been preempted by a concurrent reclaim.
          // Roll back the transaction. Zero question writes will occur.
          this.logger.warn(
            `Exam ${id} final commit fenced out — worker held version ${claimedVersion} ` +
            'but ownership was reclaimed by a concurrent worker.',
          );
          throw new ConflictException(
            'Evaluation ownership was lost to a concurrent request. The exam will be re-evaluated.',
          );
        }

        // ── Step 2: Flush all buffered question results ───────────────────────
        // These writes occur ONLY after the fencing gate confirms ownership.
        // A stale worker never reaches this code.
        for (const q of examQuestions) {
          const buffered = feedbackBuffer.get(q.id);
          const updateData: any = {};
          
          if (buffered?.isCorrect !== undefined) {
            updateData.isCorrect = buffered.isCorrect;
          }
          if (buffered?.aiFeedback) {
            updateData.aiFeedback = buffered.aiFeedback;
          }

          if (Object.keys(updateData).length > 0) {
            await tx
              .update(questions)
              .set(updateData)
              .where(eq(questions.id, q.id));
          }
        }
      });
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }

      // Unexpected exception during final commit.
      // The exam remains locked (evaluationLockedAt is set).
      // We attempt a version-fenced lock release to allow immediate user retry,
      // but ONLY if this worker still owns the current version.
      //
      // Safety: the WHERE clause includes claimedVersion so a late worker
      // cannot clear a lock it no longer owns. This prevents an old stale
      // worker from clearing a newer worker's valid lock.
      this.logger.error(`Final commit failed for exam ${id}:`, err);
      try {
        const released = await db
          .update(exams)
          .set({ evaluationLockedAt: null })
          .where(
            and(
              eq(exams.id, id),
              eq(exams.evaluationVersion, claimedVersion), // Fenced unlock — never unconditional
            ),
          )
          .returning({ id: exams.id });

        if (released.length > 0) {
          this.logger.warn(`Exam ${id} evaluation lock released after final commit failure (version ${claimedVersion}).`);
        } else {
          this.logger.warn(`Exam ${id} lock release skipped — version ${claimedVersion} no longer owned (concurrent reclaim detected).`);
        }
      } catch (unlockErr) {
        this.logger.error(`Failed to release evaluation lock for exam ${id}:`, unlockErr);
      }

      throw err;
    }

    // =========================================================================
    // POST-COMMIT SIDE EFFECTS
    //
    // Gamification is executed ONLY after the authoritative final transaction
    // successfully commits.
    //
    // TECHNICAL DEBT (Pre-existing):
    //   Gamification remains best-effort / at-most-once.
    //   If the process crashes between the DB commit and this call, the reward
    //   is permanently lost. A future Batch 3 outbox pattern would eliminate
    //   this risk. This is intentionally out of scope for Batch 2.
    //
    // TODO (Batch 3): Replace with idempotent outbox pattern using examId as
    //   the unique event identity to guarantee at-least-once delivery.
    // =========================================================================
    this.gamificationService
      .updateChallengeProgress(userId, 'exam', 1)
      .catch((err) => this.logger.warn('Challenge progress update failed:', err));

    return this.findById(id, userId);
  }

  /**
   * Generate one adaptive follow-up question targeting a weak topic identified
   * from the exam's weaknessAnalysis. Appends the question to the current exam session.
   */
  async generateNextAdaptiveQuestion(examId: string, userId: string) {
    const examData = await this.findById(examId, userId);

    if (examData.status !== 'completed') {
      throw new BadRequestException('Adaptive questions can only be generated after the exam is completed.');
    }

    const weakTopics: string[] =
      (examData.weaknessAnalysis as any)?.weakTopics ||
      (examData.weaknessAnalysis as any)?.topics ||
      [];

    if (weakTopics.length === 0) {
      throw new BadRequestException('No weak topics identified for adaptive questioning. Great job!');
    }

    // Get the file for context
    const fileResult = await db
      .select()
      .from(files)
      .where(eq(files.id, examData.fileId))
      .limit(1);

    const file = fileResult[0];
    const context = file?.extractedText?.substring(0, 8000) || '';

    // Pass existing question texts so the AI avoids repeating them
    const existingQuestionTexts = examData.questions.map((q: any) => q.questionText);

    // Determine the next order index
    const nextOrderIndex = examData.questions.length;

    this.logger.log(`Generating adaptive question for exam ${examId}, targeting: ${weakTopics.join(', ')}`);
    const newQuestion = await this.aiService.generateAdaptiveQuestion(
      weakTopics,
      context,
      existingQuestionTexts,
    );

    // Insert the adaptive question into the exam
    const insertedResult = await db
      .insert(questions)
      .values({
        examId,
        type: newQuestion.type || 'mcq',
        questionText: newQuestion.questionText,
        options: newQuestion.options || null,
        correctAnswer: String(newQuestion.correctAnswer).trim(),
        difficulty: newQuestion.difficulty || 'medium',
        orderIndex: nextOrderIndex,
        points: newQuestion.points || 1,
        explanation: newQuestion.explanation || null,
      })
      .returning();

    // Mark exam as adaptive mode
    await db
      .update(exams)
      .set({ adaptiveMode: true })
      .where(eq(exams.id, examId));

    return insertedResult[0];
  }
}
