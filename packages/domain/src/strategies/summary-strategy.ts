import { GenerationStrategy } from './generation-strategy';
import { LearningContextInterface } from '../learning-context-interface';
import { LearningArtifact } from '../learning-artifact';

export class SummaryGenerationStrategy implements GenerationStrategy {
  async generate(context: LearningContextInterface): Promise<LearningArtifact[]> {
    return [
      {
        artifactType: 'Summary',
        content: {
          summary: `Summary of ${context.focus.text || context.location.heading || context.documentTitle}`
        },
        metadata: { generatedBy: 'SummaryStrategy' },
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
