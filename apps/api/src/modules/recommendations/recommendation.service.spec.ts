import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { AiService } from '../ai/ai.service';

jest.mock('@studyai/database', () => {
  const mockSelectChain: any = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockInsertChain: any = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockUpdateChain: any = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockDb = {
    select: jest.fn(() => mockSelectChain),
    insert: jest.fn(() => mockInsertChain),
    update: jest.fn(() => mockUpdateChain),
  };

  return {
    db: mockDb,
    mockDb,
    mockSelectChain,
    mockInsertChain,
    mockUpdateChain,
    predictiveInsights: { id: 'predictiveInsights.id', userId: 'predictiveInsights.userId', subjectId: 'predictiveInsights.subjectId', predictedScore: 'predictiveInsights.predictedScore', successProbability: 'predictiveInsights.successProbability', riskLevel: 'predictiveInsights.riskLevel', recommendations: 'predictiveInsights.recommendations', calculatedAt: 'predictiveInsights.calculatedAt' },
    studyRecommendations: { id: 'studyRecommendations.id', userId: 'studyRecommendations.userId', subjectId: 'studyRecommendations.subjectId', type: 'studyRecommendations.type', title: 'studyRecommendations.title', description: 'studyRecommendations.description', isApplied: 'studyRecommendations.isApplied', scoreImportance: 'studyRecommendations.scoreImportance', createdAt: 'studyRecommendations.createdAt' },
    subjects: { id: 'subjects.id', name: 'subjects.name', userId: 'subjects.userId' },
    files: { id: 'files.id', name: 'files.name', subjectId: 'files.subjectId' },
    exams: { id: 'exams.id', fileId: 'exams.fileId', score: 'exams.score', totalQuestions: 'exams.totalQuestions', status: 'exams.status', userId: 'exams.userId' },
    questions: { id: 'questions.id', examId: 'questions.examId', isCorrect: 'questions.isCorrect' },
    eq: jest.fn((a, b) => ({ type: 'eq', a, b })),
    and: jest.fn((...args) => ({ type: 'and', args })),
    desc: jest.fn((col) => ({ type: 'desc', col })),
    sql: jest.fn(() => ({ type: 'sql' })),
  };
});

const { mockDb, mockSelectChain, mockInsertChain } = require('@studyai/database');

describe('RecommendationService', () => {
  let service: RecommendationService;
  let aiService: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: AiService,
          useValue: {
            getCompletion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    aiService = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe('getRecommendations', () => {
    it('should return stored recommendations if available', async () => {
      const mockRecs = [
        { id: 'rec-1', title: 'Read Math Book', isApplied: false },
      ];
      mockSelectChain.then.mockImplementation((callback: any) => callback(mockRecs));

      const result = await service.getRecommendations('user-1');

      expect(result).toEqual(mockRecs);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return fallback recommendations if none stored in database', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => callback([]));

      const result = await service.getRecommendations('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('rec-default-1');
      expect(result[1].id).toBe('rec-default-2');
    });
  });

  describe('generatePredictiveInsights', () => {
    it('should query the subject and exam logs, request AI forecast, and insert insights', async () => {
      // Setup mock returns for sequential queries:
      // 1. Subject check: yields a subject
      // 2. Exam records: yields 1 completed exam
      // 3. Question records: yields 2 questions
      // 4. Existing insight check: yields empty (first-time generation)
      let queryIndex = 0;
      mockSelectChain.then.mockImplementation((callback: any) => {
        queryIndex++;
        if (queryIndex === 1) {
          return callback([{ id: 'sub-1', name: 'Mathematics' }]);
        }
        if (queryIndex === 2) {
          return callback([{ examId: 'exam-1', score: 85, totalQuestions: 10 }]);
        }
        if (queryIndex === 3) {
          return callback([{ isCorrect: true }, { isCorrect: false }]);
        }
        if (queryIndex === 4) {
          return callback([]);
        }
        return callback([]);
      });

      // AI service mock returns custom analytics JSON
      const aiResponse = JSON.stringify({
        predictedScore: 92.5,
        successProbability: 0.95,
        riskLevel: 'low',
        recommendations: ['Do more calculus practice', 'Study matrix transformations'],
      });
      jest.spyOn(aiService, 'getCompletion').mockResolvedValue(aiResponse);

      // Insert mock yields inserted record
      const mockSaved = { id: 'insight-1', riskLevel: 'low' };
      mockInsertChain.then.mockImplementation((callback: any) => callback([mockSaved]));

      const result = await service.generatePredictiveInsights('user-1', 'sub-1');

      expect(result).toEqual(mockSaved);
      expect(aiService.getCompletion).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
