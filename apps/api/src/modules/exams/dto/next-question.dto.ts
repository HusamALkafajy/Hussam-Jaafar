import { IsUUID } from 'class-validator';

export class NextQuestionDto {
  @IsUUID()
  examId!: string;
}
