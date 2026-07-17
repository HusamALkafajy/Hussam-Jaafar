import { LearningAsset } from '@studyai/domain/learning-asset';
import { LearningSession } from '@studyai/domain/learning-session';
import { Recommendation } from '@studyai/domain/recommendation';
import { LearningMetrics } from '@studyai/domain/learning-metrics';

export interface UIState {
  selectedTab: 'Flashcards' | 'Quiz' | 'Revision' | 'Summaries';
  expandedSections: string[];
  drawerVisibility: {
    citation: boolean;
  };
  search: string;
  filters: Record<string, any>;
  selectedAssetId: string | null;
}

export interface WorkspaceLearningState {
  session: LearningSession | null;
  assets: LearningAsset[];
  metrics: LearningMetrics | null;
  recommendations: Recommendation[];
}

export interface WorkspaceState {
  ui: UIState;
  learning: WorkspaceLearningState;
}
