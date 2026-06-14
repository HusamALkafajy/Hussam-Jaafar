import { IsEnum } from 'class-validator';
import { MasteryLevel } from '@studyai/types';

export class ReviewFlashcardDto {
  @IsEnum(MasteryLevel)
  masteryLevel!: MasteryLevel;
}
