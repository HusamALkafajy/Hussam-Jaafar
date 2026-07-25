import { Module, forwardRef } from '@nestjs/common';
import { FlashcardSetsController, FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { FlashcardsRepository } from './flashcards.repository';
import { FlashcardEngine } from './engine/flashcard.engine';
import { FlashcardGenerator } from './engine/flashcard.generator';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [forwardRef(() => FilesModule), AiModule, StudyCoachModule, KnowledgeModule],
  controllers: [FlashcardSetsController, FlashcardsController],
  providers: [FlashcardsService, FlashcardsRepository, FlashcardEngine, FlashcardGenerator],
  exports: [FlashcardsService, FlashcardGenerator],
})
export class FlashcardsModule {}

