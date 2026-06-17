import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
