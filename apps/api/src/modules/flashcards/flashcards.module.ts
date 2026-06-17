import { Module } from '@nestjs/common';
import { FlashcardSetsController, FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';

@Module({
  imports: [FilesModule, AiModule, StudyCoachModule],
  controllers: [FlashcardSetsController, FlashcardsController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}

