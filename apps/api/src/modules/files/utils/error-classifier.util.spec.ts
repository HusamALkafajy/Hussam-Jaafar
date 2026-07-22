import { ErrorClassifier } from './error-classifier.util';
import {
  RetryableInfrastructureError,
  RetryableUpstreamError,
  RetryableRateLimitError,
  NonRetryableValidationError,
  NonRetryableUnsupportedFileError,
  NonRetryableCorruptedDocumentError,
  NonRetryableAuthorizationError,
} from './domain.exceptions';

describe('ErrorClassifier', () => {
  describe('Native JS Bugs', () => {
    it('classifies TypeError as NATIVE_RUNTIME_BUG', () => {
      const error = new TypeError('Cannot read properties of undefined');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('NATIVE_RUNTIME_BUG');
    });

    it('classifies ReferenceError as NATIVE_RUNTIME_BUG', () => {
      const error = new ReferenceError('foo is not defined');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('NATIVE_RUNTIME_BUG');
    });

    it('classifies SyntaxError as NATIVE_RUNTIME_BUG', () => {
      const error = new SyntaxError('Unexpected token');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('NATIVE_RUNTIME_BUG');
    });

    it('classifies RangeError as NATIVE_RUNTIME_BUG', () => {
      const error = new RangeError('Maximum call stack size exceeded');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('NATIVE_RUNTIME_BUG');
    });
  });

  describe('Unwrapping Error.cause and AggregateError', () => {
    it('unwraps Error.cause to find native bug', () => {
      const rootError = new TypeError('Deep failure');
      const wrapper = new Error('Job Failed');
      // @ts-ignore
      wrapper.cause = rootError;
      const result = ErrorClassifier.classify(wrapper);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('NATIVE_RUNTIME_BUG');
      expect(result.internalMessage).toContain('TypeError');
    });

    it('unwraps AggregateError to find root exception', () => {
      const dbError = new RetryableInfrastructureError('DB Down');
      const aggregate = new AggregateError([dbError], 'Multiple errors');
      const result = ErrorClassifier.classify(aggregate);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('INFRASTRUCTURE_UNAVAILABLE');
    });

    it('stops unwrapping at custom exception subclasses', () => {
      class CustomError extends Error {}
      const rootError = new TypeError('Deep');
      const customWrapper = new CustomError('Wrapped');
      // @ts-ignore
      customWrapper.cause = rootError;
      
      const result = ErrorClassifier.classify(customWrapper);
      // Since it's a CustomError, unwrapError stops there and classifies it
      // as an Unknown Internal Failure (non-retryable).
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_INTERNAL_FAILURE');
    });
  });

  describe('Domain Exceptions', () => {
    it('classifies RetryableInfrastructureError', () => {
      const error = new RetryableInfrastructureError('DB down');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('INFRASTRUCTURE_UNAVAILABLE');
    });

    it('classifies RetryableUpstreamError', () => {
      const error = new RetryableUpstreamError('API down');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('UPSTREAM_TEMPORARY_FAILURE');
    });

    it('classifies RetryableRateLimitError', () => {
      const error = new RetryableRateLimitError('Too many requests');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('UPSTREAM_RATE_LIMIT');
    });

    it('classifies NonRetryableValidationError', () => {
      const error = new NonRetryableValidationError('Invalid input');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_FAILED');
    });

    it('classifies NonRetryableUnsupportedFileError', () => {
      const error = new NonRetryableUnsupportedFileError('Unsupported MIME type');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED_DOCUMENT');
    });

    it('classifies NonRetryableCorruptedDocumentError', () => {
      const error = new NonRetryableCorruptedDocumentError('Corrupted PDF');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('CORRUPTED_DOCUMENT');
    });

    it('classifies NonRetryableAuthorizationError', () => {
      const error = new NonRetryableAuthorizationError('Unauthorized access');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('AUTHORIZATION_FAILED');
    });

    it('classifies EmptyDocumentError as EMPTY_DOCUMENT', () => {
      class EmptyDocumentError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'EmptyDocumentError';
        }
      }
      const error = new EmptyDocumentError('Empty file');
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('EMPTY_DOCUMENT');
    });
  });

  describe('Fallback Code Mapping', () => {
    it('classifies ECONNREFUSED as infrastructure failure', () => {
      const error: any = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('INFRASTRUCTURE_UNAVAILABLE');
    });

    it('classifies HTTP 429 as rate limit', () => {
      const error: any = new Error('Too Many Requests');
      error.statusCode = 429;
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('UPSTREAM_RATE_LIMIT');
    });

    it('classifies HTTP 503 as upstream failure', () => {
      const error: any = new Error('Service Unavailable');
      error.status = 503;
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(true);
      expect(result.errorCode).toBe('UPSTREAM_TEMPORARY_FAILURE');
    });

    it('classifies HTTP 403 as authorization failure', () => {
      const error: any = new Error('Forbidden');
      error.code = '403';
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('AUTHORIZATION_FAILED');
    });

    it('classifies HTTP 402 as quota exceeded', () => {
      const error: any = new Error('Payment Required');
      error.statusCode = 402;
      const result = ErrorClassifier.classify(error);
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('QUOTA_EXCEEDED');
    });
  });

  describe('Unknown Exception Fallback', () => {
    it('classifies completely unknown exceptions as NON-RETRYABLE', () => {
      const error = new Error('Something very weird happened and no one knows why');
      const result = ErrorClassifier.classify(error);
      // It is a code bug or deterministic flaw until proven otherwise
      expect(result.retryable).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_INTERNAL_FAILURE');
      expect(result.internalMessage).toContain('Something very weird happened');
    });
  });

  describe('isRetryable helper', () => {
    it('returns correct boolean without returning full object', () => {
      const retryableError = new RetryableInfrastructureError('DB');
      expect(ErrorClassifier.isRetryable(retryableError)).toBe(true);

      const nonRetryableError = new NonRetryableValidationError('Input');
      expect(ErrorClassifier.isRetryable(nonRetryableError)).toBe(false);
    });
  });
});
