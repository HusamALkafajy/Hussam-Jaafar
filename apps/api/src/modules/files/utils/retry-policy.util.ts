import { ClassificationResult } from './error-classifier.util';

export interface RetryPolicyResult {
  shouldRetry: boolean;
  delayMs: number;
}

export class RetryPolicy {
  public static readonly MAX_RETRIES = 3;
  public static readonly BASE_DELAY_MS = 30000;
  public static readonly MAX_DELAY_MS = 86400000; // 24 hours

  /**
   * Pure function evaluating retry scheduling based strictly on attempt context
   * and the abstract classification.
   *
   * @param currentAttempts Number of attempts already executed
   * @param classification The abstract evaluation of the error
   * @returns RetryPolicyResult containing viability and mathematical delay
   */
  static calculate(currentAttempts: number, classification: ClassificationResult): RetryPolicyResult {
    const isRetryable = classification.retryable && currentAttempts < this.MAX_RETRIES;

    if (!isRetryable) {
      return {
        shouldRetry: false,
        delayMs: 0,
      };
    }

    // Exponential backoff
    const exponentialBackoffMs = Math.pow(2, currentAttempts) * this.BASE_DELAY_MS;

    // Use provider hint if available and strictly larger than our exponential scale
    let chosenDelayMs = exponentialBackoffMs;
    if (
      classification.providerDelayHintMs !== undefined &&
      classification.providerDelayHintMs > exponentialBackoffMs
    ) {
      chosenDelayMs = classification.providerDelayHintMs;
    }

    // Cap at absolute maximum delay
    if (chosenDelayMs > this.MAX_DELAY_MS) {
      chosenDelayMs = this.MAX_DELAY_MS;
    }

    return {
      shouldRetry: true,
      delayMs: chosenDelayMs,
    };
  }
}
