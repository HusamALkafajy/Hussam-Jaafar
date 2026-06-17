import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MasteryLevel, SM2Quality } from '@studyai/types';

export class ReviewFlashcardDto {
  @IsEnum(MasteryLevel)
  masteryLevel!: MasteryLevel;

  /**
   * SM-2 quality score (0–5).
   * When provided, the SM-2 algorithm dynamically computes the next review date.
   * When absent, the legacy fixed-interval schedule is used.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  quality?: SM2Quality;
}
