import { GenerationStrategy } from './generation-strategy';
import { LearningContextInterface } from '../learning-context-interface';
import { LearningArtifact } from '../learning-artifact';

export class RevisionGenerationStrategy implements GenerationStrategy {
  async generate(context: LearningContextInterface): Promise<LearningArtifact[]> {
    return [
      {
        artifactType: 'RevisionPlan',
        content: {
          title: `Revision Plan for ${context.location.heading || context.documentTitle}`,
          steps: ['Review chapter', 'Complete flashcards', 'Take quiz']
        },
        metadata: { generatedBy: 'RevisionStrategy' },
        sourceCitation: {
          documentId: context.documentId,
          chapterId: context.location.chapter || null,
          sectionId: context.location.section || null,
          headingId: context.location.heading || null,
          nodeId: context.location.nodeId,
          offsetStart: context.focus.offsets?.start || null,
          offsetEnd: context.focus.offsets?.end || null
        }
      }
    ];
  }
}
