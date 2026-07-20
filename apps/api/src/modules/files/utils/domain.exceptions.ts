export class RetryableInfrastructureError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'RetryableInfrastructureError';
  }
}

export class RetryableUpstreamError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'RetryableUpstreamError';
  }
}

export class RetryableRateLimitError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'RetryableRateLimitError';
  }
}

export class NonRetryableValidationError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'NonRetryableValidationError';
  }
}

export class NonRetryableUnsupportedFileError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'NonRetryableUnsupportedFileError';
  }
}

export class NonRetryableCorruptedDocumentError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'NonRetryableCorruptedDocumentError';
  }
}

export class NonRetryableAuthorizationError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'NonRetryableAuthorizationError';
  }
}

export class LostProcessingOwnershipError extends Error {
  public readonly code = 'LOST_PROCESSING_OWNERSHIP';

  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'LostProcessingOwnershipError';
  }
}
