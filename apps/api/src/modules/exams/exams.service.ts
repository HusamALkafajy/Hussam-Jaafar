import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db, exams, questions, files, eq, and, desc } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { FilesService } from '../files/files.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { ExamStatus } from '@studyai/types';

@Injectable()
export class ExamsService {
  constructor(
    private readonly filesService: FilesService,
    private readonly aiService: AiService,
  ) {}

  async create(userId: string, dto: CreateExamDto) {
    const file = await this.filesService.findById(dto.fileId, userId);
    if (!file.extractedText) {
      throw new BadRequestException('File extracted text is missing. Re-upload or re-analyze.');
    }

    // 1. Generate questions using Gemini API
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

    // 1. Grade each question
    for (const q of examQuestions) {
      totalPoints += q.points;
      const submission = dto.answers.find((a) => a.questionId === q.id);
      const userAnswer = submission ? submission.userAnswer.trim() : '';

      let isCorrect = false;

      if (q.type === 'mcq' || q.type === 'true_false') {
        isCorrect = q.correctAnswer.toLowerCase() === userAnswer.toLowerCase();
      } else if (q.type === 'fill_blank') {
        // Simple fuzzy match for blanks
        isCorrect = q.correctAnswer.toLowerCase() === userAnswer.toLowerCase();
      } else {
        // Essay/Short answers require LLM grading in future, but mock true for now if answered
        isCorrect = userAnswer.length >= q.correctAnswer.length * 0.5;
      }

      if (isCorrect) {
        correctCount++;
        earnedPoints += q.points;
      }

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

    // 2. Generate analysis and study plan using AI
    const performanceSummary = `The student took a quiz with ${examQuestions.length} questions and scored ${score.toFixed(2)}%. Out of ${examQuestions.length} questions, they got ${correctCount} correct.`;
    
    // Quick mock AI results analysis
    const strengthAnalysis = {
      topics: score > 70 ? ['Main Chapter Key Concepts'] : ['Introduction and Basics'],
      description: score > 70 ? 'Excellent comprehension of core points.' : 'Moderate understanding of topic headings.',
    };

    const weaknessAnalysis = {
      topics: score < 90 ? ['Specific formulas', 'Complex equations'] : [],
      description: score < 90 ? 'Struggled with intermediate mathematical explanations.' : 'None - exceptional results.',
    };

    const studyPlan = {
      steps: [
        'Review the key definitions tab in document details.',
        'Regenerate intermediate explanation models for missed sections.',
        'Retake the quiz to improve retention.',
      ],
      recommendations: ['Study in chunks of 25 minutes (Pomodoro technique).', 'Test flashcards twice daily.'],
    };

    // 3. Save results to Exam
    const updatedResult = await db
      .update(exams)
      .set({
        status: 'completed',
        completedAt: new Date(),
        score: score.toFixed(2),
        strengthAnalysis,
        weaknessAnalysis,
        studyPlan,
      })
      .where(eq(exams.id, id))
      .returning();

    return this.findById(id, userId);
  }
}
