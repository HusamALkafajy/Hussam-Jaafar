import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitProjectDto {
  @IsString()
  @IsNotEmpty()
  studentSubmission: string;
}
