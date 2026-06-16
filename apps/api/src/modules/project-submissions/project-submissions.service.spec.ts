import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSubmissionsService } from './project-submissions.service';
import { AiService } from '../ai/ai.service';
import { CertificationsService } from '../certifications/certifications.service';
import { GamificationService } from '../study-coach/gamification.service';

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
    projects: { id: 'projects.id', userId: 'projects.userId' },
    learningStages: { id: 'learningStages.id', pathId: 'learningStages.pathId', orderIndex: 'learningStages.orderIndex' },
    learningPaths: { id: 'learningPaths.id' },
    knowledgeGaps: { id: 'knowledgeGaps.id' },
    aiTokenUsage: { id: 'aiTokenUsage.id' },
    eq: jest.fn((a, b) => ({ type: 'eq', a, b })),
    and: jest.fn((...args) => ({ type: 'and', args })),
    asc: jest.fn((col) => ({ type: 'asc', col })),
    sql: jest.fn(() => ({ type: 'sql' })),
  };
});

const { mockDb, mockSelectChain, mockUpdateChain, mockInsertChain } = require('@studyai/database');

describe('ProjectSubmissionsService', () => {
  let service: ProjectSubmissionsService;
  let aiService: AiService;
  let certificationsService: CertificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectSubmissionsService,
        {
          provide: AiService,
          useValue: {
            getCompletion: jest.fn(),
          },
        },
        {
          provide: CertificationsService,
          useValue: {
            issueCertificate: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: {
            addXp: jest.fn().mockResolvedValue({
              xpEarned: 100,
              totalXp: 200,
              level: 3,
              hasLeveledUp: false,
            }),
            awardBadgeByCode: jest.fn().mockResolvedValue({
              success: true,
              badge: { code: 'first_project', name: 'Real Builder', xpReward: 100 },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectSubmissionsService>(ProjectSubmissionsService);
    aiService = module.get<AiService>(AiService);
    certificationsService = module.get<CertificationsService>(CertificationsService);
    jest.clearAllMocks();
  });

  describe('submitProject', () => {
    it('should evaluate code and complete stage when passing', async () => {
      // 1. Project selection returns project
      // 2. Next stage search returns empty (completing roadmap)
      let queryIndex = 0;
      mockSelectChain.then.mockImplementation((callback: any) => {
        queryIndex++;
        if (queryIndex === 1) {
          return callback([{
            id: 'proj-1',
            stageId: 'stage-1',
            title: 'Project 1',
            description: 'Code React',
            userId: 'user-1',
            pathId: 'path-1',
            orderIndex: 0,
          }]);
        }
        return callback([]); // no next stage
      });

      const aiResponse = JSON.stringify({
        score: 85,
        passed: true,
        feedbackText: 'Great work!',
        gaps: [],
      });
      jest.spyOn(aiService, 'getCompletion').mockResolvedValue(aiResponse);

      const result = await service.submitProject('proj-1', 'user-1', {
        studentSubmission: 'console.log("React");',
      });

      expect(result.score).toBe(85);
      expect(result.passed).toBe(true);
      expect(aiService.getCompletion).toHaveBeenCalled();
      expect(certificationsService.issueCertificate).toHaveBeenCalledWith('user-1', 'path-1');
    });

    it('should evaluate code and log knowledge gaps when failing', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => {
        return callback([{
          id: 'proj-1',
          stageId: 'stage-1',
          title: 'Project 1',
          description: 'Code React',
          userId: 'user-1',
          pathId: 'path-1',
          orderIndex: 0,
        }]);
      });

      const aiResponse = JSON.stringify({
        score: 55,
        passed: false,
        feedbackText: 'Needs improvement.',
        gaps: ['hooks', 'state'],
      });
      jest.spyOn(aiService, 'getCompletion').mockResolvedValue(aiResponse);

      const result = await service.submitProject('proj-1', 'user-1', {
        studentSubmission: 'console.log("Broken React");',
      });

      expect(result.score).toBe(55);
      expect(result.passed).toBe(false);
      expect(result.gaps).toContain('hooks');
      expect(certificationsService.issueCertificate).not.toHaveBeenCalled();
    });
  });
});
