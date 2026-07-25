import { Module } from '@nestjs/common';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';
import { RetrievalOrchestrator } from './retrieval.orchestrator';
import { PedagogicalContextBuilder } from './pedagogical-context.builder';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { DocumentReadModule } from '../document-read/document-read.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    AiModule,
    RagModule,
    DocumentReadModule,
    KnowledgeModule,
  ],
  controllers: [TutorController],
  providers: [
    TutorService,
    RetrievalOrchestrator,
    PedagogicalContextBuilder,
  ],
  exports: [TutorService],
})
export class TutorModule {}
