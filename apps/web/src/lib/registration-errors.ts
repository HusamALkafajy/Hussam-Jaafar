import { ApiError } from './api-client';

export type RegistrationErrorKey =
  | 'auth.validationError'
  | 'auth.duplicateEmail'
  | 'auth.networkError'
  | 'auth.serverError'
  | 'auth.registrationFailed';

export function getRegistrationErrorKey(error: unknown): RegistrationErrorKey {
  if (!(error instanceof ApiError)) return 'auth.registrationFailed';
  if (error.status === 400) return 'auth.validationError';
  if (error.status === 409) return 'auth.duplicateEmail';
  if (error.status === 0 || error.status === 504) return 'auth.networkError';
  if (error.status >= 500) return 'auth.serverError';
  return 'auth.registrationFailed';
}
