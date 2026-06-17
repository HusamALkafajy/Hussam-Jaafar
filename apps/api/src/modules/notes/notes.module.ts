import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { AiModule } from '../ai/ai.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';

@Module({
  imports: [
    AiModule,         // for AiService (generateNoteSummary, generateNoteQuizQuestions)
    StudyCoachModule, // for GamificationService (updateChallengeProgress)
  ],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
