import { IsEmail, IsEnum } from 'class-validator';

export class RequestRelationDto {
  @IsEmail()
  email: string;

  @IsEnum(['parent', 'teacher'])
  relationType: 'parent' | 'teacher';
}
