import { IsInt, IsOptional, IsString, IsArray, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyStudyGoalMinutes?: number;

  @IsOptional()
  @IsString()
  targetGrade?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weeklyAvailableHours?: number;

  @IsOptional()
  @IsArray()
  preferredStudyTimes?: any[];

  @IsOptional()
  @IsArray()
  strengths?: string[];

  @IsOptional()
  @IsArray()
  weaknesses?: string[];
}
