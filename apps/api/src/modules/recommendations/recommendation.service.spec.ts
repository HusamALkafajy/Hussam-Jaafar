import { Test, TestingModule } from '@nestjs/testing';
import { Recommendation, UserLearningContext } from '@studyai/domain';
import { RuleEvaluationPipeline } from './pipeline/rule-evaluation.pipeline';
import { RecommendationContextBuilderProvider } from './providers/recommendation-context-builder.provider';
import { RecommendationRepository } from './recommendation.repository';
import { RecommendationService } from './recommendation.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let contextBuilder: { buildContext: jest.Mock };
  let rulePipeline: { evaluate: jest.Mock };
  let repository: {
    getPendingRecommendations: jest.Mock;
    saveRecommendations: jest.Mock;
  };

  const context: UserLearningContext = {
    userId: 'user-1',
    recentQuizzes: [],
    dueFlashcardsCount: 0,
    recentTutorSessions: [],
  };

  const generatedRecommendations: Recommendation[] = [
    {
      id: 'rec-generated-1',
      type: 'RetryQuiz',
      priority: 'High',
      confidence: 0.9,
      educationalObjective: 'Reinforce the current topic',
      explanation: 'Retry the most recent quiz.',
      evidence: [],
    },
    {
      id: 'rec-generated-2',
      type: 'ReviewFlashcards',
      priority: 'Medium',
      confidence: 0.8,
      educationalObjective: 'Improve recall',
      explanation: 'Review the due flashcards.',
      evidence: [],
    },
  ];

  beforeEach(async () => {
    contextBuilder = { buildContext: jest.fn().mockResolvedValue(context) };
    rulePipeline = { evaluate: jest.fn().mockReturnValue(generatedRecommendations) };
    repository = {
      getPendingRecommendations: jest.fn(),
      saveRecommendations: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: RecommendationContextBuilderProvider,
          useValue: contextBuilder,
        },
        { provide: RuleEvaluationPipeline, useValue: rulePipeline },
        { provide: RecommendationRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  it('returns stored recommendations without evaluating rules', async () => {
    const stored = [{ id: 'rec-stored-1', title: 'Review algebra', isApplied: false }];
    repository.getPendingRecommendations.mockResolvedValue(stored);

    await expect(service.getRecommendations('user-1')).resolves.toEqual(stored);
    expect(contextBuilder.buildContext).not.toHaveBeenCalled();
    expect(rulePipeline.evaluate).not.toHaveBeenCalled();
  });

  it('builds, persists, and maps recommendations when none are stored', async () => {
    repository.getPendingRecommendations.mockResolvedValue([]);

    const result = await service.getRecommendations('user-1');

    expect(contextBuilder.buildContext).toHaveBeenCalledWith('user-1');
    expect(rulePipeline.evaluate).toHaveBeenCalledWith(context);
    expect(repository.saveRecommendations).toHaveBeenCalledWith(
      'user-1',
      generatedRecommendations,
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'rec-generated-1',
        userId: 'user-1',
        type: 'quiz',
        scoreImportance: 3,
      }),
      expect.objectContaining({
        id: 'rec-generated-2',
        userId: 'user-1',
        type: 'study_habit',
        scoreImportance: 2,
      }),
    ]);
  });

  it('keeps generated recommendations available when persistence fails', async () => {
    repository.getPendingRecommendations.mockResolvedValue([]);
    repository.saveRecommendations.mockRejectedValue(new Error('database unavailable'));

    await expect(service.getRecommendations('user-1')).resolves.toHaveLength(2);
  });

  it('keeps predictive insights disabled while refreshing recommendations', async () => {
    const refresh = jest.spyOn(service, 'generateRecommendations').mockResolvedValue([]);

    await expect(
      service.generatePredictiveInsights('user-1', 'subject-1'),
    ).resolves.toBeNull();
    expect(refresh).toHaveBeenCalledWith('user-1');
  });
});
