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
import { AiService } from '../ai/ai.service';
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

  async function expectRequestTypeRejected(questionTypes: QuestionType[]) {
    const error = await service
      .create(userId, { ...baseDto, questionTypes })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe(
      'Only multiple-choice exam questions are supported for the current release.',
    );
    expect(quotaService.tryConsumeQuizCapacity).not.toHaveBeenCalled();
    expect(aiService.generateExam).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  }

  async function expectProviderOutputRejected(output: unknown) {
    aiService.generateExam.mockResolvedValueOnce(output);

    const error = await service.create(userId, baseDto).catch((caught) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe(
      'Generated exam contains unsupported or invalid questions. Try again.',
    );
    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
    expect(aiService.generateExam).toHaveBeenCalledTimes(1);
    expect(quotaService.refund).not.toHaveBeenCalled();
    expect(quotaService.release).not.toHaveBeenCalled();
    expect(quotaService.decrement).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
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

  it.each([
    ['an empty request', []],
    ['true/false', [QuestionType.TRUE_FALSE]],
    ['fill-in-the-blank', [QuestionType.FILL_BLANK]],
    ['essay', [QuestionType.ESSAY]],
    ['short answer', [QuestionType.SHORT]],
    ['a mixed MCQ and true/false request', [QuestionType.MCQ, QuestionType.TRUE_FALSE]],
  ] as Array<[string, QuestionType[]]>)('rejects %s before monthly admission', async (_label, types) => {
    await expectRequestTypeRejected(types);
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

  it.each([
    ['a null envelope', null],
    ['a non-object envelope', 'invalid'],
    ['an array envelope', []],
    ['a missing questions collection', { title: 'Generated exam' }],
    ['a non-array questions collection', { title: 'Generated exam', questions: {} }],
  ])('rejects %s after admission and before persistence', async (_label, output) => {
    await expectProviderOutputRejected(output);
  });

  it.each([
    ['a non-object question', null],
    ['an unsupported canonical type', { ...providerQuestions(1)[0], type: 'fill_blank' }],
    ['an unknown type', { ...providerQuestions(1)[0], type: 'matching' }],
    ['an empty question text', { ...providerQuestions(1)[0], questionText: '   ' }],
    ['missing options', { ...providerQuestions(1)[0], options: undefined }],
    ['non-array options', { ...providerQuestions(1)[0], options: 'A, B' }],
    ['fewer than two options', { ...providerQuestions(1)[0], options: ['A'] }],
    ['an empty option', { ...providerQuestions(1)[0], options: ['A', '  '] }],
    ['normalized duplicate options', { ...providerQuestions(1)[0], options: ['A', ' a '] }],
    ['an empty correct answer', { ...providerQuestions(1)[0], correctAnswer: '  ' }],
    ['a correct answer outside the options', { ...providerQuestions(1)[0], correctAnswer: 'C' }],
    ['an invalid difficulty', { ...providerQuestions(1)[0], difficulty: 'mixed' }],
    ['zero points', { ...providerQuestions(1)[0], points: 0 }],
    ['negative points', { ...providerQuestions(1)[0], points: -1 }],
    ['fractional points', { ...providerQuestions(1)[0], points: 1.5 }],
    ['non-numeric points', { ...providerQuestions(1)[0], points: '1' }],
    ['a non-string explanation', { ...providerQuestions(1)[0], explanation: 42 }],
  ])('rejects MCQ provider output containing %s', async (_label, invalidQuestion) => {
    await expectProviderOutputRejected({
      title: 'Generated exam',
      questions: [invalidQuestion],
    });
  });

  it('validates the complete provider batch before applying the count clamp', async () => {
    await expectProviderOutputRejected({
      title: 'Generated exam',
      questions: [
        ...providerQuestions(5),
        { ...providerQuestions(1)[0], type: 'essay' },
      ],
    });
  });

  it('rejects mixed difficulty when a provider question omits its difficulty', async () => {
    const question = providerQuestions(1)[0];
    delete (question as Partial<typeof question>).difficulty;
    aiService.generateExam.mockResolvedValueOnce({
      title: 'Generated exam',
      questions: [question],
    });

    const error = await service
      .create(userId, { ...baseDto, difficulty: Difficulty.MIXED })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(
      'Generated exam contains unsupported or invalid questions. Try again.',
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('persists mixed difficulty when every provider question supplies a valid difficulty', async () => {
    const questionsByDifficulty = providerQuestions(3).map((question, index) => ({
      ...question,
      difficulty: [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD][index],
    }));
    aiService.generateExam.mockResolvedValueOnce({
      title: 'Generated exam',
      questions: questionsByDifficulty,
    });

    await service.create(userId, {
      ...baseDto,
      difficulty: Difficulty.MIXED,
    });

    expect(persistedQuestions?.map((question) => question.difficulty)).toEqual([
      Difficulty.EASY,
      Difficulty.MEDIUM,
      Difficulty.HARD,
    ]);
  });

  it('preserves allowed defaults after provider validation', async () => {
    const question = providerQuestions(1)[0];
    delete (question as Partial<typeof question>).difficulty;
    delete (question as Partial<typeof question>).points;
    delete (question as Partial<typeof question>).explanation;
    aiService.generateExam.mockResolvedValueOnce({
      title: 'Generated exam',
      questions: [question],
    });

    await service.create(userId, baseDto);

    expect(persistedQuestions?.[0]).toMatchObject({
      difficulty: Difficulty.MEDIUM,
      points: 1,
      explanation: null,
    });
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

  it('creates the requested MCQ count through the real supported mock-mode generator', async () => {
    const mockModeAiService = new AiService({
      get: jest.fn().mockReturnValue(undefined),
    } as any);
    const mockModeService = new ExamsService(
      filesService as any,
      mockModeAiService,
      {} as any,
      {} as any,
      {} as any,
      quotaService as any,
    );
    jest
      .spyOn(mockModeService, 'findById')
      .mockResolvedValue({ id: 'exam-1', questions: [] } as any);

    await expect(mockModeService.create(userId, baseDto)).resolves.toEqual({
      id: 'exam-1',
      questions: [],
    });

    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledTimes(1);
    expect(quotaService.tryConsumeQuizCapacity).toHaveBeenCalledWith(userId, 5);
    expect(persistedExam?.totalQuestions).toBe(5);
    expect(persistedQuestions).toHaveLength(5);
    expect(persistedQuestions?.every((question) => question.type === QuestionType.MCQ)).toBe(
      true,
    );
  });
});
