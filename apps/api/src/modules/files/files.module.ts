import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';
import { DocumentReadModule } from '../document-read/document-read.module';
import { FileProcessingDispatcherService } from './services/file-processing-dispatcher.service';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { FileProcessingReconcilerService } from './services/file-processing-reconciler.service';
import { FileProcessingStateRepository } from './repositories/file-processing-state.repository';
import { DocumentPersistenceService } from './services/document-persistence.service';
import { FilesProcessor } from './files.processor';

@Module({
  imports: [
    AiModule,
    RagModule,
    StudyCoachModule,
    DocumentReadModule,
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FileProcessingDispatcherService,
    FileProcessingExecutionService,
    FileProcessingReconcilerService,
    FileProcessingStateRepository,
    DocumentPersistenceService,
    FilesProcessor,
  ],
  exports: [FilesService, DocumentPersistenceService],
})
export class FilesModule implements OnModuleInit {
  constructor(
    @Inject('IWorkerRegistry') private readonly registry: any,
    private readonly filesProcessor: FilesProcessor
  ) {}

  onModuleInit() {
    const handlers = new Map<string, any>();
    handlers.set('process-file', this.filesProcessor);

    this.registry.register('default-worker-1', {
      supportedJobTypes: ['process-file'],
      maxConcurrency: 5,
      priority: 1,
      queues: ['studyai-main-queue']
    }, handlers);
  }
}
