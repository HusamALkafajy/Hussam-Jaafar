export enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  IMAGE = 'image',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface FileMetadata {
  pageCount?: number;
  originalName?: string;
  wordCount?: number;
  description?: string;
  [key: string]: any;
}

export interface File {
  id: string;
  userId: string;
  subjectId?: string | null;
  originalName: string;
  storageKey: string;
  storageUrl: string;
  fileType: FileType;
  mimeType: string;
  fileSize: number;
  pageCount?: number | null;
  extractedText?: string | null;
  metadata?: FileMetadata | null;
  processingStatus: ProcessingStatus;
  processingError?: string | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  fileCount: number;
  createdAt: Date;
}

export interface CreateSubjectDto {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateSubjectDto {
  name?: string;
  color?: string;
  icon?: string;
}

export interface AssignSubjectDto {
  subjectId?: string | null;
}
