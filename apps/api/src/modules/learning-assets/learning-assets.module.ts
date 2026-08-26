import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { LearningAssetPipeline } from './learning-asset.pipeline';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { FlashcardGenerator } from '../flashcards/engine/flashcard.generator';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { QuizGenerator } from '../quizzes/engine/quiz.generator';

@Module({
  imports: [
    forwardRef(() => FlashcardsModule), // Needs FlashcardGenerator from FlashcardsModule
    forwardRef(() => QuizzesModule), // Needs QuizGenerator
  ],
  providers: [
    LearningAssetPipeline,
  ],
  exports: [
    LearningAssetPipeline,
  ]
})
export class LearningAssetsModule implements OnModuleInit {
  constructor(
    private readonly pipeline: LearningAssetPipeline,
    private readonly flashcardGenerator: FlashcardGenerator,
    private readonly quizGenerator: QuizGenerator
  ) {}

  onModuleInit() {
    this.pipeline.registerGenerators([
      this.flashcardGenerator,
      this.quizGenerator
    ]);
  }
}
