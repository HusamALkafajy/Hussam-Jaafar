import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [FilesModule, AiModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
