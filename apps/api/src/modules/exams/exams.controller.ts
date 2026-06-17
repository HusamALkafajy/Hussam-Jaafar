import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateExamDto } from './dto/create-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

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
    return this.examsService.generateNextAdaptiveQuestion(id, userId);
  }
}
