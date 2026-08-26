import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('documents/:id/tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post('chat')
  async chat(
    @CurrentUser('sub') userId: string,
    @Param('id') documentId: string,
    @Body('question') question: string,
  ) {
    return this.tutorService.chat(documentId, userId, question);
  }

  @Get('history')
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Param('id') documentId: string,
  ) {
    return this.tutorService.getHistory(documentId, userId);
  }

  @Delete('history')
  async deleteHistory(
    @CurrentUser('sub') userId: string,
    @Param('id') documentId: string,
  ) {
    return this.tutorService.deleteHistory(documentId, userId);
  }
}
