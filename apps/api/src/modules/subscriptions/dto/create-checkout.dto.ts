import { IsEnum, IsNotEmpty } from 'class-validator';
import { SubscriptionTier } from '@studyai/types';

export class CreateCheckoutDto {
  @IsNotEmpty()
  @IsEnum([SubscriptionTier.PRO, SubscriptionTier.INSTITUTION], {
    message: 'Plan must be either "pro" or "institution"',
  })
  plan: SubscriptionTier;
}
