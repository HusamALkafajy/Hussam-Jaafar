import { Recommendation } from '@studyai/domain/recommendation';

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec_1',
    type: 'ReviewWeakConcepts',
    priority: 'High',
    confidence: 0.95,
    educationalObjective: 'Address knowledge gaps before proceeding',
    explanation: 'You struggled with this concept recently.',
    evidence: [],
    targetResourceId: 'asset_1'
  }
];
