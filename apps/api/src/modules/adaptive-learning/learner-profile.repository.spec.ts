import { Test, TestingModule } from '@nestjs/testing';
import { LearnerProfileRepository } from './learner-profile.repository';

// Mock DB
jest.mock('@studyai/database', () => ({
  db: {
    query: {
      exams: { findMany: jest.fn() },
      flashcardSets: { findMany: jest.fn() },
      analytics: { findFirst: jest.fn() },
    },
  },
  exams: { userId: 'mock-userId', createdAt: 'mock-createdAt' },
  flashcardSets: { userId: 'mock-userId', createdAt: 'mock-createdAt' },
  analytics: { userId: 'mock-userId', date: 'mock-date' },
}));

import { db } from '@studyai/database';

describe('LearnerProfileRepository', () => {
  let repository: LearnerProfileRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LearnerProfileRepository],
    }).compile();

    repository = module.get<LearnerProfileRepository>(LearnerProfileRepository);
  });

  describe('Profile Generation (Aggregation Boundary)', () => {
    it('should aggregate data from exams to determine strong and weak concepts', async () => {
      (db.query.exams.findMany as jest.Mock).mockResolvedValue([
        { score: 95, strengthAnalysis: ['concept-a', 'concept-b'], weaknessAnalysis: [] },
        { score: 80, strengthAnalysis: ['concept-a'], weaknessAnalysis: ['concept-c'] },
      ]);
      (db.query.flashcardSets.findMany as jest.Mock).mockResolvedValue([]);
      (db.query.analytics.findFirst as jest.Mock).mockResolvedValue({ date: '2023-01-01', studyMinutes: 30 });

      const profile = await repository.buildProfileForUser('u1');

      expect(profile.strongConcepts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conceptId: 'concept-a' }),
          expect.objectContaining({ conceptId: 'concept-b' }),
        ])
      );

      expect(profile.weakConcepts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conceptId: 'concept-c' }),
        ])
      );
    });

    it('should fall back to safe defaults when no data is present', async () => {
      (db.query.exams.findMany as jest.Mock).mockResolvedValue([]);
      (db.query.flashcardSets.findMany as jest.Mock).mockResolvedValue([]);
      (db.query.analytics.findFirst as jest.Mock).mockResolvedValue(null);

      const profile = await repository.buildProfileForUser('u1');

      expect(profile.currentLevel).toBe('Beginner');
      expect(profile.strongConcepts.length).toBe(0);
      expect(profile.weakConcepts.length).toBe(0);
      expect(profile.consistencyScore).toBe(0.2); // Default fallback
    });
  });
});
