import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadFileDto {
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;
}
