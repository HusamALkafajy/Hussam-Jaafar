import { Test, TestingModule } from '@nestjs/testing';
import { MasteryEstimatorService } from './mastery-estimator.service';
import { LearnerProfile } from '@studyai/domain';

describe('MasteryEstimatorService', () => {
  let service: MasteryEstimatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MasteryEstimatorService],
    }).compile();

    service = module.get<MasteryEstimatorService>(MasteryEstimatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Missing Data Handling', () => {
    it('should return a conservative estimate when no evidence exists', () => {
      const profile: LearnerProfile = {
        userId: 'u1',
        currentLevel: 'Beginner',
        preferredPace: 'Standard',
        strongConcepts: [],
        weakConcepts: [],
        recentActivity: { lastStudySession: '', totalSessionsThisWeek: 0, averageSessionDurationMinutes: 0, learningStreakDays: 0 },
        consistencyScore: 0,
        updatedAt: '',
      };

      const result = service.estimateMastery('u1', profile, 'unknown-concept');

      expect(result.score).toBe(0.1);
      expect(result.confidence).toBe(0);
      expect(result.calculationMethod).toBe('Deterministic');
      expect(result.evidence).toContain('No sufficient educational evidence');
    });

    it('should correctly identify a strong concept', () => {
      const profile: LearnerProfile = {
        userId: 'u1',
        currentLevel: 'Beginner',
        preferredPace: 'Standard',
        strongConcepts: [{ conceptId: 'c1', masteryScore: 0.9, confidence: 0.8, lastEvaluatedAt: '' }],
        weakConcepts: [],
        recentActivity: { lastStudySession: '', totalSessionsThisWeek: 0, averageSessionDurationMinutes: 0, learningStreakDays: 0 },
        consistencyScore: 0,
        updatedAt: '',
      };

      const result = service.estimateMastery('u1', profile, 'c1');

      expect(result.score).toBe(0.9);
      expect(result.confidence).toBe(0.8);
      expect(result.evidence).toContain('strong area');
    });
  });
});
