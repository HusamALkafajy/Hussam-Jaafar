import { Module, Global } from '@nestjs/common';
import { RagService } from './rag.service';
import { AiModule } from '../ai/ai.module';
import { SemanticChunkEngine } from './chunking/semantic-chunk.engine';
import { HeuristicTokenEstimator } from './chunking/estimators/heuristic-token.estimator';

@Global()
@Module({
  imports: [AiModule],
  providers: [
    RagService, 
    { provide: 'TOKEN_ESTIMATOR', useClass: HeuristicTokenEstimator },
    SemanticChunkEngine
  ],
  exports: [RagService, SemanticChunkEngine],
})
export class RagModule {}
