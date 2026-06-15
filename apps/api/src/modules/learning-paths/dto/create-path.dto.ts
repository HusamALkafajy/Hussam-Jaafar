import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreatePathDto {
  @IsString()
  @IsNotEmpty()
  skillName: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['beginner', 'intermediate', 'advanced'], {
    message: 'Difficulty level must be beginner, intermediate, or advanced',
  })
  difficultyLevel: string;

  @IsString()
  @IsNotEmpty()
  endGoal: string;

  @IsOptional()
  @IsNumber()
  dailyAvailableMinutes?: number;
}
