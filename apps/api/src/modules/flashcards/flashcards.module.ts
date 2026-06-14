import { Module } from '@nestjs/common';
import { FlashcardSetsController, FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [FilesModule, AiModule],
  controllers: [FlashcardSetsController, FlashcardsController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
