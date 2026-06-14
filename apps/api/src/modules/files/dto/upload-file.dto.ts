import { IsString, IsUUID, IsOptional } from 'class-validator';

export class UploadFileDto {
  @IsUUID()
  @IsOptional()
  subjectId?: string;
}
