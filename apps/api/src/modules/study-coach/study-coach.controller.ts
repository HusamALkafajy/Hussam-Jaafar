import { Controller, Post, Get, Body, Param, Patch, UseGuards, Query } from '@nestjs/common';
import { StudyCoachService } from './study-coach.service';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RequestRelationDto } from './dto/request-relation.dto';

@Controller('study-coach')
@UseGuards(JwtAuthGuard)
export class StudyCoachController {
  constructor(
    private readonly studyCoachService: StudyCoachService,
    private readonly gamificationService: GamificationService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.studyCoachService.getStudentProfile(userId);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.studyCoachService.updateStudentProfile(userId, dto);
  }

  @Get('plans')
  async getPlans(@CurrentUser('sub') userId: string) {
    return this.studyCoachService.getStudyPlans(userId);
  }

  @Post('plans')
  async createPlan(@CurrentUser('sub') userId: string, @Body() dto: CreatePlanDto) {
    return this.studyCoachService.createStudyPlan(userId, dto);
  }

  @Get('tasks')
  async getTasks(@CurrentUser('sub') userId: string, @Query('date') date?: string) {
    return this.studyCoachService.getTasks(userId, date);
  }

  @Patch('tasks/:id')
  async updateTask(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.studyCoachService.updateTaskStatus(userId, id, dto);
  }

  @Get('gamification/badges')
  async getBadges(@CurrentUser('sub') userId: string) {
    return this.gamificationService.getBadges(userId);
  }

  @Get('gamification/challenges')
  async getChallenges(@CurrentUser('sub') userId: string) {
    return this.gamificationService.getActiveChallenges(userId);
  }

  @Post('relations')
  async requestRelation(@CurrentUser('sub') userId: string, @Body() dto: RequestRelationDto) {
    return this.studyCoachService.requestRelation(userId, dto);
  }

  @Get('relations/guardian')
  async getGuardianRelations(@CurrentUser('sub') userId: string) {
    return this.studyCoachService.getGuardianRelations(userId);
  }

  @Patch('relations/guardian/:id/approve')
  async approveRelation(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.studyCoachService.approveRelation(userId, id);
  }
}
