import { IsArray, ValidateNested, IsUUID, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsString()
  userAnswer!: string;
}

export class SubmitExamDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];
}
