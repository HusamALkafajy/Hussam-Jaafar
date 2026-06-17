import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { db, exams, questions, files, eq, and, desc, sql } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { RagService } from '../rag/rag.service';
import { GamificationService } from '../study-coach/gamification.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { ExamStatus } from '@studyai/types';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly gamificationService: GamificationService,
  ) {}

  async create(userId: string, dto: CreateExamDto) {
    const file = await this.filesService.findById(dto.fileId, userId);
    if (!file.extractedText) {
      throw new BadRequestException('File extracted text is missing. Re-upload or re-analyze.');
    }

    // 1. Generate questions using the configured AI provider
    const generated = await this.aiService.generateExam(
      file.extractedText,
      dto.difficulty,
      dto.questionTypes,
      dto.totalQuestions,
    );

    const title = generated.title || `اختبار: ${file.originalName}`;
    const generatedQuestions = generated.questions || [];

    if (generatedQuestions.length === 0) {
      throw new BadRequestException('Failed to generate questions. Try again.');
    }

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
      options: q.options || null,
      correctAnswer: String(q.correctAnswer).trim(),
      difficulty: q.difficulty || dto.difficulty,
      orderIndex: index,
      points: q.points || 1,
      explanation: q.explanation || null,
    }));

    await db.insert(questions).values(questionValues);

    return this.findById(exam.id, userId);
  }

  async findAll(userId: string) {
    return db
      .select()
      .from(exams)
      .where(eq(exams.userId, userId))
      .orderBy(desc(exams.createdAt));
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
    };
  }

  async submit(id: string, userId: string, dto: SubmitExamDto) {
    const examData = await this.findById(id, userId);
    if (examData.status === 'completed') {
      throw new BadRequestException('Exam has already been submitted');
    }

    const examQuestions = examData.questions;
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    // 1. Grade each question and collect results for AI feedback
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
      const submission = dto.answers.find((a) => a.questionId === q.id);
      const userAnswer = submission ? submission.userAnswer.trim() : '';

      let isCorrect = false;

      if (q.type === 'mcq' || q.type === 'true_false') {
        isCorrect = q.correctAnswer.toLowerCase() === userAnswer.toLowerCase();
      } else if (q.type === 'fill_blank') {
        isCorrect = q.correctAnswer.toLowerCase() === userAnswer.toLowerCase();
      }
      // Essay and short answers: isCorrect defaults to false here;
      // the AI feedback will provide proper scoring in generateExamFeedback.
      // We update isCorrect after AI analysis for essays.

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

      await db
        .update(questions)
        .set({
          userAnswer,
          isCorrect,
          answeredAt: new Date(),
        })
        .where(eq(questions.id, q.id));
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    // 2. Retrieve RAG context for wrong answers (to help the AI explain them)
    this.logger.log(`Generating RAG context for exam ${id} feedback...`);
    const wrongResults = questionResults.filter((r) => !r.isCorrect);
    let ragContextParts: string[] = [];

    for (const wrong of wrongResults.slice(0, 5)) {
      // Limit to 5 wrong answers to avoid massive prompts
      try {
        const chunks = await this.ragService.searchChunks(
          examData.fileId,
          wrong.questionText,
          3,
        );
        if (chunks.length > 0) {
          ragContextParts.push(
            `[Context for: "${wrong.questionText}"]\n` +
              chunks.map((c) => `Page ${c.pageNumber}: ${c.content}`).join('\n'),
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to get RAG context for question ${wrong.questionId}:`, err);
      }
    }

    const ragContext = ragContextParts.join('\n\n---\n\n');

    // 3. Generate real AI feedback via LLM
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

    // 4. Write per-question AI feedback to DB
    if (aiFeedbackResult.perQuestionFeedback?.length > 0) {
      for (const qFeedback of aiFeedbackResult.perQuestionFeedback) {
        const feedbackText = [qFeedback.feedback, qFeedback.miniLesson]
          .filter(Boolean)
          .join('\n\n');
        await db
          .update(questions)
          .set({ aiFeedback: feedbackText })
          .where(eq(questions.id, qFeedback.questionId));
      }
    }

    // 5. Save final results to Exam
    await db
      .update(exams)
      .set({
        status: 'completed',
        completedAt: new Date(),
        score: score.toFixed(2),
        strengthAnalysis: aiFeedbackResult.strengthAnalysis,
        weaknessAnalysis: aiFeedbackResult.weaknessAnalysis,
        studyPlan: aiFeedbackResult.studyPlan,
      })
      .where(eq(exams.id, id));

    // Award gamification challenge progress for exam completion (fire-and-forget)
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
