import { Controller, Post, Get, Body, Param, UseGuards, Inject, ForbiddenException } from '@nestjs/common';
import type { IConfigurationProvider, ApplicationConfiguration } from '@studyai/infrastructure';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateExamDto } from './dto/create-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    @Inject('IConfigurationProvider')
    private readonly configurationProvider: IConfigurationProvider<ApplicationConfiguration>,
  ) {}

  @Post()
  async createExam(@CurrentUser('sub') userId: string, @Body() dto: CreateExamDto) {
    return this.examsService.create(userId, dto);
  }

  @Get()
  async getExams(@CurrentUser('sub') userId: string) {
    return this.examsService.findAll(userId);
  }

  @Get(':id')
  async getExam(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.examsService.findById(id, userId);
  }

  @Post(':id/submit')
  async submitExam(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SubmitExamDto,
  ) {
    return this.examsService.submit(id, userId, dto);
  }

  /**
   * Generate one adaptive follow-up question targeting a weak topic from this exam.
   * The new question is appended to the current exam session.
   */
  @Post(':id/next-question')
  async nextAdaptiveQuestion(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    // Preserve the existing owner-scoped 404 contract before disclosing whether
    // this future capability is enabled for the current release.
    await this.examsService.findById(id, userId);

    if (!this.configurationProvider.features.isEnabled('adaptive_exam', { userId })) {
      throw new ForbiddenException('Adaptive exam questions are disabled for the current release.');
    }

    return this.examsService.generateNextAdaptiveQuestion(id, userId);
  }
}
