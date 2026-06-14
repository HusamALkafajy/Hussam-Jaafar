import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { FlashcardsService } from './flashcards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFlashcardSetDto } from './dto/create-flashcard-set.dto';
import { ReviewFlashcardDto } from './dto/review-flashcard.dto';

@Controller('flashcard-sets')
@UseGuards(JwtAuthGuard)
export class FlashcardSetsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post()
  async createSet(@CurrentUser('sub') userId: string, @Body() dto: CreateFlashcardSetDto) {
    return this.flashcardsService.create(userId, dto);
  }

  @Get()
  async getSets(@CurrentUser('sub') userId: string) {
    return this.flashcardsService.findAll(userId);
  }

  @Get(':id')
  async getSet(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.flashcardsService.findById(id, userId);
  }
}

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Patch(':id/review')
  async reviewCard(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.flashcardsService.reviewCard(id, userId, dto);
  }
}
