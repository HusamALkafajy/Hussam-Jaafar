import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';
import { DocumentReadModule } from '../document-read/document-read.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [FilesModule, AiModule, RagModule, StudyCoachModule, DocumentReadModule, QuotaModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}


