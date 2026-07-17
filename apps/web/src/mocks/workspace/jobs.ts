import { ErrorType } from './errors';
import { TimelineStage } from './timeline';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ProcessingJob {
  id: string;
  uploadId: string;
  filename: string;
  sizeBytes: number;
  pageCount?: number;
  language?: string;
  status: JobStatus;
  currentStage: TimelineStage;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
  estimatedRemainingTimeSeconds?: number;
  errorType?: ErrorType;
}

export const MOCK_JOBS: ProcessingJob[] = [
  {
    id: 'job_1',
    uploadId: 'upl_1',
    filename: 'Biology_101_Midterm_Notes.pdf',
    sizeBytes: 4500000,
    pageCount: 32,
    language: 'English',
    status: 'completed',
    currentStage: 'COMPLETED',
    progress: 100,
    createdAt: '2026-06-30T10:31:00Z',
    updatedAt: '2026-06-30T10:35:10Z',
    estimatedRemainingTimeSeconds: 0,
  },
  {
    id: 'job_2',
    uploadId: 'upl_2',
    filename: 'Research_Methodology_Draft_v2.docx',
    sizeBytes: 1200000,
    pageCount: 14,
    language: 'English',
    status: 'processing',
    currentStage: 'EXTRACTING',
    progress: 45,
    createdAt: '2026-06-30T11:00:00Z',
    updatedAt: '2026-06-30T11:05:00Z',
    estimatedRemainingTimeSeconds: 45,
  },
  {
    id: 'job_3',
    uploadId: 'upl_3',
    filename: 'Complete_Genome_Sequencing.zip',
    sizeBytes: 150000000,
    status: 'failed',
    currentStage: 'UPLOADING',
    progress: 10,
    createdAt: '2026-06-30T12:00:00Z',
    updatedAt: '2026-06-30T12:00:05Z',
    errorType: 'FILE_TOO_LARGE'
  },
  {
    id: 'job_4',
    uploadId: 'upl_4',
    filename: 'Physics_Lab_Data.xlsx',
    sizeBytes: 250000,
    status: 'failed',
    currentStage: 'EXTRACTING',
    progress: 30,
    createdAt: '2026-06-30T12:15:00Z',
    updatedAt: '2026-06-30T12:16:00Z',
    errorType: 'UNSUPPORTED_FORMAT'
  },
  {
    id: 'job_5',
    uploadId: 'upl_5',
    filename: 'Intro_to_Psychology_Ch1-3.pdf',
    sizeBytes: 8500000,
    pageCount: 120,
    status: 'queued',
    currentStage: 'QUEUED',
    progress: 0,
    createdAt: '2026-06-30T12:30:00Z',
    updatedAt: '2026-06-30T12:30:00Z',
    estimatedRemainingTimeSeconds: 120,
  },
  {
    id: 'job_6',
    uploadId: 'upl_6',
    filename: 'Advanced_Calculus_Final_Exam_2025.pdf',
    sizeBytes: 3000000,
    pageCount: 15,
    status: 'processing',
    currentStage: 'VALIDATING',
    progress: 80,
    createdAt: '2026-06-30T12:25:00Z',
    updatedAt: '2026-06-30T12:29:00Z',
    estimatedRemainingTimeSeconds: 15,
  }
];
