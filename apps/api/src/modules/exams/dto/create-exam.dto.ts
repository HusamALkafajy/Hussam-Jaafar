import { IsUUID, IsEnum, IsInt, Min, Max, IsArray, IsOptional } from 'class-validator';
import { Difficulty, QuestionType } from '@studyai/types';

export class CreateExamDto {
  @IsUUID()
  fileId!: string;

  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @IsInt()
  @Min(5)
  @Max(50)
  totalQuestions!: number;

  @IsInt()
  @Min(5)
  @Max(120)
  @IsOptional()
  timeLimitMinutes?: number;

  @IsArray()
  @IsEnum(QuestionType, { each: true })
  questionTypes!: QuestionType[];
}
