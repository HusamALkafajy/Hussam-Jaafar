import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';
import { FileProcessingDispatcherService } from './services/file-processing-dispatcher.service';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { FileProcessingReconcilerService } from './services/file-processing-reconciler.service';
import { FilesProcessor } from './files.processor';

@Module({
  imports: [
    AiModule,
    RagModule,
    StudyCoachModule,
    BullModule.registerQueue({
      name: 'file-processing',
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FileProcessingDispatcherService,
    FileProcessingExecutionService,
    FileProcessingReconcilerService,
    FilesProcessor,
  ],
  exports: [FilesService],
})
export class FilesModule {}
