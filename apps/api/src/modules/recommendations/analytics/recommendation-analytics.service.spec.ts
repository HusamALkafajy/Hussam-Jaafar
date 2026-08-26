import { RecommendationAnalyticsService } from './recommendation-analytics.service';
import { RecommendationAnalyticsRepository } from './recommendation-analytics.repository';
import { RecommendationAnalyticsEvent } from '@studyai/domain';
import { Logger } from '@nestjs/common';

describe('RecommendationAnalyticsService', () => {
  let service: RecommendationAnalyticsService;
  let repository: jest.Mocked<RecommendationAnalyticsRepository>;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    repository = {
      insertEvent: jest.fn(),
      getRuleEffectivenessMetrics: jest.fn(),
    } as unknown as jest.Mocked<RecommendationAnalyticsRepository>;

    service = new RecommendationAnalyticsService(repository);
    
    // Silence logger during tests
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('should successfully publish an event', async () => {
    const event: RecommendationAnalyticsEvent = {
      ruleIdentifier: 'rule_1',
      recommendationType: 'ReviewFlashcards',
      action: 'displayed',
      userId: 'user_1',
    };

    repository.insertEvent.mockResolvedValueOnce(undefined);

    await expect(service.publishEvent(event)).resolves.not.toThrow();
    expect(repository.insertEvent).toHaveBeenCalledWith(event);
  });

  it('should isolate failures and not throw when publishing an event fails', async () => {
    const event: RecommendationAnalyticsEvent = {
      ruleIdentifier: 'rule_1',
      recommendationType: 'ReviewFlashcards',
      action: 'displayed',
      userId: 'user_1',
    };

    repository.insertEvent.mockRejectedValueOnce(new Error('DB Error'));

    // The service must catch the error and not throw it back to the caller
    await expect(service.publishEvent(event)).resolves.not.toThrow();
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('should fetch rule effectiveness metrics', async () => {
    const metrics = {
      ruleIdentifier: 'rule_1',
      displayCount: 100,
      clickCount: 10,
      completionCount: 5,
      clickThroughRate: 10,
      completionRate: 5,
      effectivenessScore: 7, // 0.4*10 + 0.6*5
    };

    repository.getRuleEffectivenessMetrics.mockResolvedValueOnce(metrics);

    const result = await service.getRuleEffectiveness('rule_1');
    expect(result).toEqual(metrics);
    expect(repository.getRuleEffectivenessMetrics).toHaveBeenCalledWith('rule_1');
  });
});
