import { IsEnum } from 'class-validator';
import { Locale } from '@studyai/types';

export class UpdateLocaleDto {
  @IsEnum(Locale)
  locale!: Locale;
}
