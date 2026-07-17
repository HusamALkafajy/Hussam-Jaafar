import { Recommendation } from '@studyai/domain/recommendation';

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec_1',
    priority: 'High',
    confidence: 0.95,
    reason: 'You struggled with this concept recently.',
    source: 'InteractionHistory',
    nextAction: 'ReviewAsset',
    targetId: 'asset_1'
  }
];
