import { IsOptional, IsString, IsInt, Min, Max, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FileType } from '@studyai/types';

export class FileQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsEnum(FileType)
  @IsOptional()
  fileType?: FileType;

  @IsString()
  @IsOptional()
  search?: string;
}
