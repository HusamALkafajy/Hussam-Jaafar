import { FileType } from '@studyai/types';

export const CANONICAL_UPLOAD_FORMATS: Record<string, FileType> = {
  'application/pdf': FileType.PDF,
};

export const ALLOWED_UPLOAD_MIMES = new Set(Object.keys(CANONICAL_UPLOAD_FORMATS));
