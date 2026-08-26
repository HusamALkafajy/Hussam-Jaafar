import { Module } from '@nestjs/common';
import { QuizGenerator } from './engine/quiz.generator';
import { QuizzesRepository } from './quizzes.repository';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  providers: [QuizGenerator, QuizzesRepository],
  exports: [QuizGenerator, QuizzesRepository],
})
export class QuizzesModule {}
