import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateTaskDto {
  @IsEnum(['pending', 'completed', 'skipped', 'rescheduled'])
  status: 'pending' | 'completed' | 'skipped' | 'rescheduled';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoreReceived?: number;
}
