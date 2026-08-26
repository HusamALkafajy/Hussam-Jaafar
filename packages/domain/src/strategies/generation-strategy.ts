import { LearningContextInterface } from '../learning-context-interface';
import { LearningArtifact } from '../learning-artifact';

export interface GenerationStrategy {
  generate(context: LearningContextInterface): Promise<LearningArtifact[]>;
}
