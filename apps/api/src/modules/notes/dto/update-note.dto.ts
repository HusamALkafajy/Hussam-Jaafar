import { IsString, IsOptional, IsBoolean, MaxLength, IsIn } from 'class-validator';

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['default', 'red', 'green', 'blue', 'yellow', 'purple'])
  color?: string;
}
