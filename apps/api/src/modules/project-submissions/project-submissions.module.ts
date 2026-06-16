import { Module } from '@nestjs/common';
import { ProjectSubmissionsController } from './project-submissions.controller';
import { ProjectSubmissionsService } from './project-submissions.service';
import { AiModule } from '../ai/ai.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { StudyCoachModule } from '../study-coach/study-coach.module';

@Module({
  imports: [AiModule, CertificationsModule, StudyCoachModule],
  controllers: [ProjectSubmissionsController],
  providers: [ProjectSubmissionsService],
  exports: [ProjectSubmissionsService],
})
export class ProjectSubmissionsModule {}
