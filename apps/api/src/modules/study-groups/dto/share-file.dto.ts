import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ShareFileDto {
  @IsUUID()
  @IsNotEmpty()
  fileId: string;
}
