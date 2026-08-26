import { Test, TestingModule } from '@nestjs/testing';
import { LearningPathPlannerService } from './learning-path-planner.service';
import { LearnerProfile, AdaptiveGoal, Recommendation } from '@studyai/domain';

describe('LearningPathPlannerService', () => {
  let service: LearningPathPlannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LearningPathPlannerService],
    }).compile();

    service = module.get<LearningPathPlannerService>(LearningPathPlannerService);
  });

  describe('Adaptive Decision Generation', () => {
    it('should prioritize recommendations that align with Critical goals', () => {
      const profile = { userId: 'u1' } as LearnerProfile;
      
      const goals: AdaptiveGoal[] = [
        {
          id: 'g1',
          userId: 'u1',
          goalType: 'ImproveWeakConcept',
          objective: 'Learn algebra',
          priority: 'Critical',
          estimatedEffortMinutes: 30,
          progressPercentage: 10,
          targetConceptId: 'c1',
          evidence: 'Weak in algebra',
          createdAt: '',
          updatedAt: '',
        }
      ];

      const recs: Recommendation[] = [
        { id: 'r1', type: 'ReviewWeakConcepts', confidence: 0.99, targetResourceId: 'c2' } as any, // Higher score, wrong concept
        { id: 'r2', type: 'ReviewFlashcards', confidence: 0.50, targetResourceId: 'c1' } as any, // Lower score, matching concept
      ];

      const result = service.planPath(profile, goals, recs);

      // The planner should prioritize r2 because it satisfies the critical goal
      expect(result[0].recommendation.id).toBe('r2');
      expect(result[0].assignedGoalId).toBe('g1');
      expect(result[0].explanation).toContain('Recommended with high priority to address your goal');
    });
  });
});
