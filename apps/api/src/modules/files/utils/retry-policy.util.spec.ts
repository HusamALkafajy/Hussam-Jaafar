import { RetryPolicy } from './retry-policy.util';
import { ClassificationResult } from './error-classifier.util';

describe('RetryPolicy', () => {
  const baseRetryableClassification: ClassificationResult = {
    retryable: true,
    errorCode: 'TEST_RETRYABLE',
    userMessage: 'Test',
    internalMessage: 'Test',
  };

  const nonRetryableClassification: ClassificationResult = {
    retryable: false,
    errorCode: 'TEST_NON_RETRYABLE',
    userMessage: 'Test',
    internalMessage: 'Test',
  };

  describe('Pure Mathematics & Determinism', () => {
    it('should return 30000ms (30s) delay for the first attempt (attempt 0)', () => {
      const result = RetryPolicy.calculate(0, baseRetryableClassification);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(30000);
    });

    it('should return 60000ms (60s) delay for the second attempt (attempt 1)', () => {
      const result = RetryPolicy.calculate(1, baseRetryableClassification);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(60000);
    });

    it('should return 120000ms (120s) delay for the third attempt (attempt 2)', () => {
      const result = RetryPolicy.calculate(2, baseRetryableClassification);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(120000);
    });
  });

  describe('Attempt Limits', () => {
    it('should deny retry when MAX_RETRIES is reached (attempt 3)', () => {
      const result = RetryPolicy.calculate(3, baseRetryableClassification);
      expect(result.shouldRetry).toBe(false);
      expect(result.delayMs).toBe(0);
    });

    it('should deny retry when classification is inherently non-retryable', () => {
      const result = RetryPolicy.calculate(0, nonRetryableClassification);
      expect(result.shouldRetry).toBe(false);
      expect(result.delayMs).toBe(0);
    });
  });

  describe('Provider Delay Hints', () => {
    it('should honor providerDelayHintMs if it is strictly larger than exponential backoff', () => {
      // attempt 0 backoff is 30s. Provider asks for 3600s.
      const classificationWithHint: ClassificationResult = {
        ...baseRetryableClassification,
        providerDelayHintMs: 3600000,
      };

      const result = RetryPolicy.calculate(0, classificationWithHint);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(3600000);
    });

    it('should ignore providerDelayHintMs if it is smaller than exponential backoff', () => {
      // attempt 2 backoff is 120s. Provider asks for 10s.
      // We enforce the mathematical backoff to protect our own queues.
      const classificationWithHint: ClassificationResult = {
        ...baseRetryableClassification,
        providerDelayHintMs: 10000,
      };

      const result = RetryPolicy.calculate(2, classificationWithHint);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(120000);
    });

    it('should support immediate retry if provider requests it AND we allow it (future proofing)', () => {
      // Right now the math forces 30s minimum because base delay is 30s.
      // If we wanted immediate retry we'd need to bypass exponential backoff entirely.
      // Since our current design says: chosenDelayMs = Math.max(exponential, hint),
      // we know 0ms hint will be overridden by 30000ms.
      // We test this behavior to document the contract limit.
      const classificationWithHint: ClassificationResult = {
        ...baseRetryableClassification,
        providerDelayHintMs: 0,
      };

      const result = RetryPolicy.calculate(0, classificationWithHint);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(30000);
    });
  });

  describe('Absolute Caps', () => {
    it('should cap the delay at MAX_DELAY_MS even if provider hint is enormous', () => {
      const enormousDelay = RetryPolicy.MAX_DELAY_MS + 100000;
      const classificationWithHint: ClassificationResult = {
        ...baseRetryableClassification,
        providerDelayHintMs: enormousDelay,
      };

      const result = RetryPolicy.calculate(0, classificationWithHint);
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(RetryPolicy.MAX_DELAY_MS);
    });
  });
});
