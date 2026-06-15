import { Module } from '@nestjs/common';
import { ProjectSubmissionsController } from './project-submissions.controller';
import { ProjectSubmissionsService } from './project-submissions.service';
import { AiModule } from '../ai/ai.module';
import { CertificationsModule } from '../certifications/certifications.module';

@Module({
  imports: [AiModule, CertificationsModule],
  controllers: [ProjectSubmissionsController],
  providers: [ProjectSubmissionsService],
  exports: [ProjectSubmissionsService],
})
export class ProjectSubmissionsModule {}
