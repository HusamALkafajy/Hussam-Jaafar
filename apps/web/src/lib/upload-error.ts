import { ApiError, AuthExpiredError, QuotaError } from './api-client';

export type UploadMessageKey =
  | 'files.maxSize'
  | 'files.invalidType'
  | 'files.sessionExpired'
  | 'files.quotaExceeded'
  | 'files.uploadStorageFailure'
  | 'files.uploadProcessingFailure'
  | 'files.uploadNetworkFailure'
  | 'files.uploadServerFailure';

export function uploadErrorMessageKey(error: unknown): UploadMessageKey {
  if (error instanceof AuthExpiredError) return 'files.sessionExpired';
  if (error instanceof QuotaError) return 'files.quotaExceeded';
  if (!(error instanceof ApiError)) return 'files.uploadServerFailure';
  if (error.kind === 'network' || error.kind === 'timeout') return 'files.uploadNetworkFailure';
  if (error.status === 401) return 'files.sessionExpired';
  switch (error.errorCode) {
    case 'FILE_TOO_LARGE':
      return 'files.maxSize';
    case 'UNSUPPORTED_FILE_TYPE':
    case 'INVALID_UPLOAD':
      return 'files.invalidType';
    case 'QUOTA_EXCEEDED':
      return 'files.quotaExceeded';
    case 'UPLOAD_STORAGE_FAILED':
      return 'files.uploadStorageFailure';
    case 'UPLOAD_PROCESSING_FAILED':
      return 'files.uploadProcessingFailure';
    default:
      return 'files.uploadServerFailure';
  }
}
