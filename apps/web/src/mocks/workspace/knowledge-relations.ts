import { KnowledgeRelation } from '@studyai/domain/knowledge-relation';

export const MOCK_KNOWLEDGE_RELATIONS: KnowledgeRelation[] = [
  {
    id: 'rel_1',
    sourceEntityId: 'asset_1',
    targetEntityId: 'node_1',
    relationType: 'RelatedTo',
    confidence: 0.9
  }
];
