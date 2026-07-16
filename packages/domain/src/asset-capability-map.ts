import { ArtifactType } from './learning-artifact';

export type AssetCapability = 'View' | 'Edit' | 'Review' | 'Export' | 'Archive';

export const ASSET_CAPABILITY_MAP: Record<ArtifactType, AssetCapability[]> = {
  Flashcard: ['View', 'Edit', 'Review', 'Export', 'Archive'],
  QuizQuestion: ['View', 'Edit', 'Review', 'Export', 'Archive'],
  RevisionPlan: ['View', 'Edit', 'Export', 'Archive'],
  Summary: ['View', 'Export', 'Archive'],
  MindMap: ['View', 'Export', 'Archive'],
  ConceptGraph: ['View', 'Export', 'Archive']
};
