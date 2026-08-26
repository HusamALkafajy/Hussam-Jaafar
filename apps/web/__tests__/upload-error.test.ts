import { describe, expect, it } from 'vitest';
import { ApiError, AuthExpiredError, QuotaError } from '../src/lib/api-client';
import { uploadErrorMessageKey } from '../src/lib/upload-error';

describe('upload error translation', () => {
  it.each([
    [new ApiError('safe', 413, 'http', 'FILE_TOO_LARGE'), 'files.maxSize'],
    [new ApiError('safe', 400, 'http', 'UNSUPPORTED_FILE_TYPE'), 'files.invalidType'],
    [new ApiError('safe', 503, 'http', 'UPLOAD_STORAGE_FAILED'), 'files.uploadStorageFailure'],
    [new ApiError('safe', 500, 'http', 'UPLOAD_PROCESSING_FAILED'), 'files.uploadProcessingFailure'],
    [new ApiError('safe', 0, 'network'), 'files.uploadNetworkFailure'],
    [new ApiError('safe', 500, 'http'), 'files.uploadServerFailure'],
    [new AuthExpiredError(), 'files.sessionExpired'],
    [new QuotaError('safe'), 'files.quotaExceeded'],
  ])('maps a structured failure to %s', (error, expected) => {
    expect(uploadErrorMessageKey(error)).toBe(expected);
  });
});
