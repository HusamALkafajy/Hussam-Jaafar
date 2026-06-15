import { Test, TestingModule } from '@nestjs/testing';
import { LearningPathsService } from './learning-paths.service';
import { AiService } from '../ai/ai.service';

jest.mock('@studyai/database', () => {
  const mockSelectChain: any = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    then: jest.fn(function (resolve, reject) {
      return Promise.resolve(this._results || []).then(resolve, reject);
    }),
  };

  const mockInsertChain: any = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    then: jest.fn(function (resolve, reject) {
      return Promise.resolve(this._results || []).then(resolve, reject);
    }),
  };

  const mockUpdateChain: any = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    then: jest.fn(function (resolve, reject) {
      return Promise.resolve(this._results || []).then(resolve, reject);
    }),
  };

  const mockDb: any = {
    select: jest.fn(() => mockSelectChain),
    insert: jest.fn(() => mockInsertChain),
    update: jest.fn(() => mockUpdateChain),
  };
  mockDb.transaction = jest.fn(async (cb) => cb(mockDb));

  return {
    db: mockDb,
    mockDb,
    mockSelectChain,
    mockInsertChain,
    mockUpdateChain,
    learningPaths: { id: 'learningPaths.id' },
    learningStages: { id: 'learningStages.id', pathId: 'learningStages.pathId', orderIndex: 'learningStages.orderIndex' },
    lessons: { id: 'lessons.id', stageId: 'lessons.stageId' },
    projects: { id: 'projects.id', stageId: 'projects.stageId', userId: 'projects.userId' },
    certifications: { id: 'certifications.id' },
    knowledgeGaps: { id: 'knowledgeGaps.id' },
    aiTokenUsage: { id: 'aiTokenUsage.id' },
    eq: jest.fn((a, b) => ({ type: 'eq', a, b })),
    and: jest.fn((...args) => ({ type: 'and', args })),
    asc: jest.fn((col) => ({ type: 'asc', col })),
    sql: jest.fn(() => ({ type: 'sql' })),
  };
});

const { mockDb, mockSelectChain, mockInsertChain, mockUpdateChain } = require('@studyai/database');

describe('LearningPathsService', () => {
  let service: LearningPathsService;
  let aiService: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningPathsService,
        {
          provide: AiService,
          useValue: {
            getCompletion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LearningPathsService>(LearningPathsService);
    aiService = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe('createPath', () => {
    it('should generate roadmap via AI and insert records in transaction', async () => {
      const aiResponse = JSON.stringify({
        stages: [
          {
            title: 'Intro Stage',
            description: 'Intro desc',
            estimatedHours: 4,
            lessons: [{ title: 'Lesson 1', content: 'Lesson content' }],
            project: { title: 'Proj 1', description: 'Proj desc', starterCode: 'Starter' },
          },
        ],
      });

      jest.spyOn(aiService, 'getCompletion').mockResolvedValue(aiResponse);

      const mockPath = { id: 'path-1' };
      const mockStage = { id: 'stage-1' };

      // Mock database calls
      let insertIndex = 0;
      mockInsertChain.returning.mockImplementation(() => {
        insertIndex++;
        if (insertIndex === 1) {
          // Path insert
          return Promise.resolve([mockPath]);
        }
        if (insertIndex === 2) {
          // Stage insert
          return Promise.resolve([mockStage]);
        }
        return Promise.resolve([]);
      });

      const result = await service.createPath('user-1', {
        skillName: 'React',
        difficultyLevel: 'beginner',
        endGoal: 'Build web app',
        dailyAvailableMinutes: 45,
      });

      expect(result).toEqual(mockPath);
      expect(aiService.getCompletion).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('completeLesson', () => {
    it('should update lesson completion status when exists', async () => {
      mockSelectChain._results = [{ lessonId: 'lesson-1', stageId: 'stage-1', pathId: 'path-1', userId: 'user-1' }];

      const mockUpdated = { id: 'lesson-1', isCompleted: true };
      mockUpdateChain._results = [mockUpdated];

      const result = await service.completeLesson('lesson-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.lesson).toEqual(mockUpdated);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if lesson not found or user is not owner', async () => {
      mockSelectChain._results = [];

      await expect(service.completeLesson('lesson-invalid', 'user-1')).rejects.toThrow();
    });
  });
});
