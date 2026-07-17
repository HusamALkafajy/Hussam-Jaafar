import { LearningAsset } from '@studyai/domain/learning-asset';

export const MOCK_LEARNING_ASSETS: LearningAsset[] = [
  {
    assetId: 'asset_1',
    assetType: 'Flashcard',
    sourceCitation: {
      documentId: 'doc_1',
      chapterId: 'ch_1',
      sectionId: 'sec_1',
      headingId: null,
      nodeId: 'node_1',
      offsetStart: 0,
      offsetEnd: 10
    },
    difficulty: 'Medium',
    metadata: { tags: ['test'] },
    content: { front: 'Test front', back: 'Test back' },
    createdAt: '2026-07-01T10:00:00Z',
    status: 'Generated'
  }
];
