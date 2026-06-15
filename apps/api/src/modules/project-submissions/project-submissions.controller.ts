import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectSubmissionsService } from './project-submissions.service';
import { SubmitProjectDto } from './dto/submit-project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectSubmissionsController {
  constructor(private readonly projectSubmissionsService: ProjectSubmissionsService) {}

  @Post(':id/submit')
  async submitProject(
    @Param('id') projectId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitProjectDto,
  ) {
    return this.projectSubmissionsService.submitProject(projectId, userId, dto);
  }
}
