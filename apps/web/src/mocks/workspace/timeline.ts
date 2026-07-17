export type TimelineStage = 
  | 'UPLOADING'
  | 'QUEUED'
  | 'EXTRACTING'
  | 'BUILDING_AST'
  | 'VALIDATING'
  | 'INDEXING'
  | 'FINALIZING'
  | 'COMPLETED';

export interface TimelineEvent {
  stage: TimelineStage;
  status: 'pending' | 'active' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  progress?: number; // 0 to 100
}

export const MOCK_COMPACT_TIMELINE: TimelineStage[] = [
  'UPLOADING',
  'QUEUED',
  'EXTRACTING', // mapped to "Processing" in UI
  'COMPLETED',  // mapped to "Ready" in UI
];

export const MOCK_EXPANDED_TIMELINE: TimelineStage[] = [
  'UPLOADING',
  'QUEUED',
  'EXTRACTING',
  'BUILDING_AST',
  'VALIDATING',
  'INDEXING',
  'FINALIZING',
  'COMPLETED'
];
