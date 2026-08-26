import { GenerationStrategy } from './generation-strategy';
import { LearningContextInterface } from '../learning-context-interface';
import { LearningArtifact } from '../learning-artifact';

export class QuizGenerationStrategy implements GenerationStrategy {
  async generate(context: LearningContextInterface): Promise<LearningArtifact[]> {
    return [
      {
        artifactType: 'QuizQuestion',
        content: {
          question: `Multiple choice question about ${context.location.heading || context.documentTitle}`,
          options: ['Option A', 'Option B', 'Option C'],
          correctAnswerIndex: 0
        },
        metadata: { generatedBy: 'QuizStrategy' },
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
