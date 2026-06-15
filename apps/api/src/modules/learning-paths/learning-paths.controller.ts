import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';
import { CreatePathDto } from './dto/create-path.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('learning-paths')
@UseGuards(JwtAuthGuard)
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  @Post()
  async createPath(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePathDto,
  ) {
    return this.learningPathsService.createPath(userId, dto);
  }

  @Get()
  async getPaths(@CurrentUser('sub') userId: string) {
    return this.learningPathsService.getPaths(userId);
  }

  @Get(':id')
  async getPathDetail(
    @Param('id') pathId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.learningPathsService.getPathDetail(pathId, userId);
  }

  @Patch('lessons/:id/complete')
  async completeLesson(
    @Param('id') lessonId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.learningPathsService.completeLesson(lessonId, userId);
  }
}
