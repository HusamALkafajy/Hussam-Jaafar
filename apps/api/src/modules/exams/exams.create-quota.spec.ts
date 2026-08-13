jest.mock('@studyai/database', () => ({
  db: { insert: jest.fn() },
  exams: Symbol('exams'),
  questions: Symbol('questions'),
  files: Symbol('files'),
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  desc: jest.fn(),
  sql: jest.fn(),
  isNull: jest.fn(),
  lt: jest.fn(),
}));

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { db, exams, questions } from '@studyai/database';
import { Difficulty, QuestionType } from '@studyai/types';
import { ExamsService, TooManyRequestsException } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';

describe('ExamsService.create monthly Quiz capacity contract', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const file = {
    id: '00000000-0000-4000-8000-000000000002',
    originalName: 'course.pdf',
    extractedText: 'Course content',
  };

  const baseDto: CreateExamDto = {
    fileId: file.id,
    difficulty: Difficulty.MEDIUM,
    totalQuestions: 5,
    questionTypes: [QuestionType.MCQ],
  };

  let events: string[];
  let persistedExam: Record<string, unknown> | undefined;
  let persistedQuestions: Array<Record<string, unknown>> | undefined;
  let filesService: { findById: jest.Mock };
  let aiService: { generateExam: jest.Mock };
  let quotaService: {
    tryConsumeQuizCapacity: jest.Mock;
    refund: jest.Mock;
    release: jest.Mock;
    decrement: jest.Mock;
  };
  let service: ExamsService;

  function providerQuestions(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      type: 'mcq',
      questionText: `Question ${index + 1}`,
      options: ['A', 'B'],
      correctAnswer: 'A',
      difficulty: 'medium',
      points: 1,
      explanation: `Explanation ${index + 1}`,
    }));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    events = [];
    persistedExam = undefined;
    persistedQuestions = undefined;

    filesService = {
      findById: jest.fn(async () => {
        events.push('local prerequisites');
        return file;
      }),
    };
    quotaService = {
      tryConsumeQuizCapacity: jest.fn(async () => {
        events.push('quota admission');
        return { admitted: true, usedAfter: 5 };
      }),
      refund: jest.fn(),
      release: jest.fn(),
      decrement: jest.fn(),
    };
    aiService = {
      generateExam: jest.fn(async () => {
        events.push('AI generation');
        return { title: 'Generated exam', questions: providerQuestions(5) };
      }),
    };

    (db.insert as unknown as jest.Mock).mockImplementation((table) => {
      if (table === exams) {
        return {
          values: jest.fn((values) => {
            events.push('Exam persistence');
            persistedExam = values;
            return {
              returning: jest.fn().mockResolvedValue([{ id: 'exam-1' }]),
            };
          }),
        };
      }

      if (table === questions) {
        return {
          values: jest.fn(async (values) => {
            events.push('Question persistence');
            persistedQuestions = values;
          }),
        };
      }

      throw new Error('Unexpected persistence target');
    });

    service = new ExamsService(
      filesService as any,
      aiService as any,
      {} as any,
      {} as any,
      {} as any,
      quotaService as any,
    );
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'exam-1', questions: [] } as any);
  });

  it('does not consume capacity or persist when file ownership lookup fails', async () => {
    filesService.findById.mockRejectedValueOnce(new NotFoundException('File not found'));

    await expect(service.create(userId, baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(quotaService.tryConsumeQuizCapacity).not.toHaveBeenCalled();
    expect(aiService.generateExam).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('does not consume capacity or persist when extracted text is missing', async () => {
    filesService.findById.mockResolvedValueOnce({ ...file, extractedText: null });

    await expect(service.create(userId, baseDto)).rejects.toThrow(
      'File extracted text is missing. Re-upload or re-analyze.',
    );

    expect(quotaService.tryConsumeQuizCapacity).not.toHaveBeenCalled();
    expect(aiService.generateExam).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects denied admission with the stable 429 contract before AI or persistence', async () => {
    quotaService.tryConsumeQuizCapacity.mockResolvedValueOnce({
      admitted: false,
      reason: 'MONTHLY_LIMIT_EXCEEDED',
    });

    const error = await service.create(userId, baseDto).catch((caught) => caught);

    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
    expect(error).toBeInstanceOf(TooManyRequestsException);
    expect(error.getStatus()).toBe(429);
    expect(error.message).toBe('Monthly quiz question limit exceeded.');
    expect(aiService.generateExam).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('orders local prerequisites, one admission, AI, and persistence exactly', async () => {
    await service.create(userId, baseDto);

    expect(events).toEqual([
      'local prerequisites',
      'quota admission',
      'AI generation',
      'Exam persistence',
      'Question persistence',
    ]);
    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledTimes(1);
    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
  });

  it('does not refund admitted capacity when the provider throws', async () => {
    const providerError = new Error('provider unavailable');
    aiService.generateExam.mockRejectedValueOnce(providerError);

    await expect(service.create(userId, baseDto)).rejects.toBe(providerError);

    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
    expect(quotaService.refund).not.toHaveBeenCalled();
    expect(quotaService.release).not.toHaveBeenCalled();
    expect(quotaService.decrement).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('clamps excess provider output to requested capacity and preserves order', async () => {
    aiService.generateExam.mockResolvedValueOnce({
      title: 'Generated exam',
      questions: providerQuestions(8),
    });

    await service.create(userId, baseDto);

    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
    expect(persistedExam?.totalQuestions).toBe(5);
    expect(persistedQuestions).toHaveLength(5);
    expect(persistedQuestions?.map((question) => question.questionText)).toEqual([
      'Question 1',
      'Question 2',
      'Question 3',
      'Question 4',
      'Question 5',
    ]);
  });

  it('consumes requested capacity while persisting fewer provider questions', async () => {
    const dto = { ...baseDto, totalQuestions: 10 };
    aiService.generateExam.mockResolvedValueOnce({
      title: 'Generated exam',
      questions: providerQuestions(6),
    });

    await service.create(userId, dto);

    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 10);
    expect(persistedExam?.totalQuestions).toBe(6);
    expect(persistedQuestions).toHaveLength(6);
  });

  it('keeps admission consumed and rejects zero provider questions before persistence', async () => {
    aiService.generateExam.mockResolvedValueOnce({
      title: 'Generated exam',
      questions: [],
    });

    await expect(service.create(userId, baseDto)).rejects.toEqual(
      new BadRequestException('Failed to generate questions. Try again.'),
    );

    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
    expect(quotaService.refund).not.toHaveBeenCalled();
    expect(quotaService.release).not.toHaveBeenCalled();
    expect(quotaService.decrement).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('continues normally for the exact admitted capacity result object', async () => {
    quotaService.tryConsumeQuizCapacity.mockResolvedValueOnce({
      admitted: true,
      usedAfter: 50,
    });

    await expect(service.create(userId, baseDto)).resolves.toEqual({
      id: 'exam-1',
      questions: [],
    });

    expect(aiService.generateExam).toHaveBeenCalledTimes(1);
    expect(persistedQuestions).toHaveLength(5);
  });
});
