import { Module } from '@nestjs/common';
import { KnowledgeGraphBuilder } from './knowledge-graph.builder';
import { DeterministicKnowledgeProvider } from './providers/deterministic-knowledge.provider';
import { AiKnowledgeProvider } from './providers/ai-knowledge.provider';
import { KnowledgeGraphRepository } from './knowledge-graph.repository';
import { KnowledgeGraphConsumer } from './providers/knowledge-graph-consumer';
import { KnowledgeEvidenceAssembler } from './providers/knowledge-evidence-assembler';

@Module({
  providers: [
    {
      provide: 'PRIMARY_KNOWLEDGE_PROVIDER',
      useClass: DeterministicKnowledgeProvider
    },
    {
      provide: 'ENRICHMENT_KNOWLEDGE_PROVIDERS',
      useFactory: (aiProvider: AiKnowledgeProvider) => [aiProvider],
      inject: [AiKnowledgeProvider]
    },
    DeterministicKnowledgeProvider,
    AiKnowledgeProvider,
    KnowledgeGraphRepository,
    {
      provide: KnowledgeGraphBuilder,
      useFactory: (primary, enrichments) => new KnowledgeGraphBuilder(primary, enrichments),
      inject: ['PRIMARY_KNOWLEDGE_PROVIDER', 'ENRICHMENT_KNOWLEDGE_PROVIDERS']
    },
    KnowledgeGraphConsumer,
    KnowledgeEvidenceAssembler
  ],
  exports: [KnowledgeGraphBuilder, KnowledgeGraphRepository, KnowledgeGraphConsumer, KnowledgeEvidenceAssembler],
})
export class KnowledgeModule {}
