import {
  RetryableInfrastructureError,
  RetryableUpstreamError,
  RetryableRateLimitError,
  NonRetryableValidationError,
  NonRetryableUnsupportedFileError,
  NonRetryableCorruptedDocumentError,
  NonRetryableAuthorizationError,
} from './domain.exceptions';

export interface ClassificationResult {
  retryable: boolean;
  errorCode: string;
  userMessage: string;
  internalMessage: string;
  providerDelayHintMs?: number;
}

export class ErrorClassifier {
  static classify(error: unknown): ClassificationResult {
    // 0. Unwrap AggregateErrors and Error.cause if top-level is generic
    const rootError = this.unwrapError(error);

    // 1. Native JS / V8 Programming Bugs
    // These are mathematically deterministic. Retrying them will always fail.
    if (
      rootError instanceof TypeError ||
      rootError instanceof ReferenceError ||
      rootError instanceof SyntaxError ||
      rootError instanceof RangeError ||
      rootError instanceof URIError ||
      rootError instanceof EvalError ||
      (typeof rootError === 'object' && rootError !== null && rootError.name === 'AssertionError')
    ) {
      return {
        retryable: false,
        errorCode: 'NATIVE_RUNTIME_BUG',
        userMessage: 'An internal application error occurred.',
        internalMessage: `Deterministic code bug: ${rootError.name} - ${rootError.message}`,
      };
    }

    // 2. Explicit Domain Exceptions
    if (rootError instanceof RetryableInfrastructureError) {
      return {
        retryable: true,
        errorCode: 'INFRASTRUCTURE_UNAVAILABLE',
        userMessage: 'A temporary infrastructure issue occurred. We will retry shortly.',
        internalMessage: rootError.message,
      };
    }

    if (rootError instanceof RetryableUpstreamError) {
      return {
        retryable: true,
        errorCode: 'UPSTREAM_TEMPORARY_FAILURE',
        userMessage: 'A temporary provider issue occurred. We will retry shortly.',
        internalMessage: rootError.message,
      };
    }

    if (rootError instanceof RetryableRateLimitError) {
      return {
        retryable: true,
        errorCode: 'UPSTREAM_RATE_LIMIT',
        userMessage: 'The service is experiencing high traffic. We will retry shortly.',
        internalMessage: rootError.message,
      };
    }

    if (rootError instanceof NonRetryableValidationError) {
      return {
        retryable: false,
        errorCode: 'VALIDATION_FAILED',
        userMessage: 'The provided data is invalid.',
        internalMessage: rootError.message,
      };
    }

    if (rootError instanceof NonRetryableUnsupportedFileError) {
      return {
        retryable: false,
        errorCode: 'UNSUPPORTED_DOCUMENT',
        userMessage: 'The provided file type is not supported.',
        internalMessage: rootError.message,
      };
    }

    if (rootError instanceof NonRetryableCorruptedDocumentError) {
      return {
        retryable: false,
        errorCode: 'CORRUPTED_DOCUMENT',
        userMessage: 'The provided document appears to be corrupted and cannot be read.',
        internalMessage: rootError.message,
      };
    }

    if (rootError instanceof NonRetryableAuthorizationError) {
      return {
        retryable: false,
        errorCode: 'AUTHORIZATION_FAILED',
        userMessage: 'You are not authorized to perform this action.',
        internalMessage: rootError.message,
      };
    }

    // 3. Fallback Mapping for Uncaught Third-Party Errors
    // It is highly recommended to wrap all third-party errors into Domain Exceptions 
    // at the integration boundary (Adapters). These fallbacks exist purely as a safety net.
    const errObj = rootError as Record<string, any>;
    const errMessage = rootError instanceof Error ? rootError.message : String(rootError);
    const errCode = errObj?.code || errObj?.statusCode || errObj?.status;

    // Infrastructure: Connection Refused / Database Driver specific codes
    if (
      errCode === 'ECONNREFUSED' || 
      errCode === 'ENOTFOUND' ||
      errCode === 'ETIMEDOUT' ||
      errCode === '57P01' || // Admin shutdown
      errCode === '57P02' || // Crash shutdown
      errCode === '57P03' || // Cannot connect now
      errCode === '08000' || // Connection exception
      errCode === '08003' || // Connection does not exist
      errCode === '08006' || // Connection failure
      errCode === '40P01'    // Deadlock detected
    ) {
      return {
        retryable: true,
        errorCode: 'INFRASTRUCTURE_UNAVAILABLE',
        userMessage: 'A temporary infrastructure issue occurred. We will retry shortly.',
        internalMessage: `Fallback Network/DB Error: ${errCode}`,
      };
    }

    // Upstream: HTTP 429 Rate Limit
    if (errCode === 429 || errCode === '429') {
      return {
        retryable: true,
        errorCode: 'UPSTREAM_RATE_LIMIT',
        userMessage: 'The service is currently rate limited. We will retry shortly.',
        internalMessage: 'Fallback HTTP 429',
      };
    }

    // Upstream: HTTP 500+
    if (
      (typeof errCode === 'number' && errCode >= 500) ||
      (typeof errCode === 'string' && /^(500|502|503|504)$/.test(errCode))
    ) {
      return {
        retryable: true,
        errorCode: 'UPSTREAM_TEMPORARY_FAILURE',
        userMessage: 'A temporary provider issue occurred. We will retry shortly.',
        internalMessage: `Fallback HTTP 5xx Error: ${errCode}`,
      };
    }

    // Authorization: HTTP 401/403
    if (errCode === 401 || errCode === '401' || errCode === 403 || errCode === '403') {
      return {
        retryable: false,
        errorCode: 'AUTHORIZATION_FAILED',
        userMessage: 'You are not authorized to perform this action.',
        internalMessage: `Fallback HTTP ${errCode}`,
      };
    }

    // Quota: HTTP 402
    if (errCode === 402 || errCode === '402') {
      return {
        retryable: false,
        errorCode: 'QUOTA_EXCEEDED',
        userMessage: 'Your account billing limit has been reached.',
        internalMessage: 'Fallback HTTP 402',
      };
    }

    // 4. Unknown Exception Fallback
    // If the error matches nothing (no domain exception, no HTTP code, no network code),
    // we classify it as a NON-RETRYABLE Unknown Internal Failure.
    // Why non-retryable? Because transient network/DB failures usually provide explicit codes 
    // (ECONNREFUSED, 503). A completely unknown error is most likely an unmapped code bug or 
    // a deterministic failure. Retrying it blindly risks infinite poison-pill loops.
    // Explicitly unmapped errors should fail-fast so engineers can map them to Domain Exceptions.
    return {
      retryable: false,
      errorCode: 'UNKNOWN_INTERNAL_FAILURE',
      userMessage: 'An unexpected error occurred.',
      internalMessage: errMessage || 'Unknown Error',
    };
  }

  static isRetryable(error: unknown): boolean {
    return this.classify(error).retryable;
  }

  private static unwrapError(error: unknown): any {
    if (error instanceof AggregateError && error.errors.length > 0) {
      // Pick the first error to classify
      return this.unwrapError(error.errors[0]);
    }

    if (error instanceof Error && (error as any).cause) {
      // If the current error is just a generic wrapper, dig into the cause
      if (error.constructor === Error) {
        return this.unwrapError((error as any).cause);
      }
    }

    return error;
  }
}
