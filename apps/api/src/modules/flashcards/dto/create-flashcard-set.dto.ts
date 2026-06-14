import { IsUUID, IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateFlashcardSetDto {
  @IsUUID()
  fileId!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(5)
  @Max(30)
  @IsOptional()
  count?: number = 10;
}
