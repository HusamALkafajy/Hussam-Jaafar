import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';
import { DocumentReadModule } from '../document-read/document-read.module';
import { FileProcessingDispatcherService } from './services/file-processing-dispatcher.service';
import { FileProcessingReconcilerService } from './services/file-processing-reconciler.service';
import { FileProcessingStateRepository } from './repositories/file-processing-state.repository';
import { DocumentPersistenceService } from './services/document-persistence.service';
import { FilesProcessor } from './files.processor';
import { ExtractorRegistry } from './services/extractor.registry';
import { LegacyFallbackAdapter } from './services/extractors/legacy-fallback.adapter';
import { NativePdfExtractor } from './services/extractors/native-pdf.extractor';

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
    FileProcessingReconcilerService,
    FileProcessingStateRepository,
    DocumentPersistenceService,
    FilesProcessor,
    ExtractorRegistry,
    LegacyFallbackAdapter,
    NativePdfExtractor,
  ],
  exports: [FilesService, DocumentPersistenceService],
})
export class FilesModule implements OnModuleInit {
  constructor(
    @Inject('IWorkerRegistry') private readonly registry: any,
    private readonly filesProcessor: FilesProcessor,
    private readonly extractorRegistry: ExtractorRegistry,
    private readonly legacyFallbackAdapter: LegacyFallbackAdapter,
    private readonly nativePdfExtractor: NativePdfExtractor,
  ) {}

  onModuleInit() {
    // Populate the extraction registry
    this.extractorRegistry.register('application/pdf', this.nativePdfExtractor);
    this.extractorRegistry.register('image/jpeg', this.legacyFallbackAdapter);
    this.extractorRegistry.register('image/png', this.legacyFallbackAdapter);
    this.extractorRegistry.register('image/webp', this.legacyFallbackAdapter);
    this.extractorRegistry.register('application/vnd.openxmlformats-officedocument.wordprocessingml.document', this.legacyFallbackAdapter);
    
    // Fallback for missing MIME type (from legacy defaults)
    this.extractorRegistry.register('application/octet-stream', this.legacyFallbackAdapter);

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
