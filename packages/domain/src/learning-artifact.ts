import { ImmutableCitation } from './citation';

export type ArtifactType = 'Flashcard' | 'QuizQuestion' | 'RevisionPlan' | 'Summary' | 'MindMap' | 'ConceptGraph';

export interface LearningArtifact {
  readonly artifactType: ArtifactType;
  readonly content: any;
  readonly metadata: Record<string, any>;
  readonly sourceCitation: ImmutableCitation;
}
