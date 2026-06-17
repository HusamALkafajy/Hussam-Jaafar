import { IsString, IsOptional, IsUUID, MaxLength, IsIn } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MaxLength(255)
  title: string = 'Untitled Note';

  @IsString()
  content: string = '';

  @IsOptional()
  @IsUUID()
  fileId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['default', 'red', 'green', 'blue', 'yellow', 'purple'])
  color?: string = 'default';
}
