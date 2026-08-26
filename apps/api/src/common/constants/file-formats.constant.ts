import { FileType } from '@studyai/types';

export const CANONICAL_UPLOAD_FORMATS: Record<string, FileType> = {
  'application/pdf': FileType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.DOCX,
  'image/jpeg': FileType.IMAGE,
  'image/png': FileType.IMAGE,
  'image/webp': FileType.IMAGE,
};

export const ALLOWED_UPLOAD_MIMES = new Set(Object.keys(CANONICAL_UPLOAD_FORMATS));
