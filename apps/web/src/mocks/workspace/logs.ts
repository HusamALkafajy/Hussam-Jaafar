export interface ProcessingLogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export const MOCK_LOGS: Record<string, ProcessingLogEntry[]> = {
  'job_1': [
    { id: 'log_1', timestamp: '2026-06-30T10:31:00Z', message: 'Upload received', level: 'info' },
    { id: 'log_2', timestamp: '2026-06-30T10:31:05Z', message: 'Waiting for queue', level: 'info' },
    { id: 'log_3', timestamp: '2026-06-30T10:32:00Z', message: 'Extracting text', level: 'info' },
    { id: 'log_4', timestamp: '2026-06-30T10:33:10Z', message: 'Building document model', level: 'info' },
    { id: 'log_5', timestamp: '2026-06-30T10:34:00Z', message: 'Validating AST', level: 'info' },
    { id: 'log_6', timestamp: '2026-06-30T10:34:45Z', message: 'Indexing document for semantic search', level: 'info' },
    { id: 'log_7', timestamp: '2026-06-30T10:35:00Z', message: 'Finalizing', level: 'info' },
    { id: 'log_8', timestamp: '2026-06-30T10:35:10Z', message: 'Completed', level: 'info' },
  ],
  'job_2': [
    { id: 'log_1', timestamp: '2026-06-30T11:00:00Z', message: 'Upload received', level: 'info' },
    { id: 'log_2', timestamp: '2026-06-30T11:00:10Z', message: 'Waiting for queue', level: 'info' },
    { id: 'log_3', timestamp: '2026-06-30T11:05:00Z', message: 'Extracting text', level: 'info' },
  ],
  'job_3': [
    { id: 'log_1', timestamp: '2026-06-30T12:00:00Z', message: 'Upload received', level: 'info' },
    { id: 'log_2', timestamp: '2026-06-30T12:00:05Z', message: 'Error: File exceeds maximum allowed size (100MB)', level: 'error' },
  ]
};
