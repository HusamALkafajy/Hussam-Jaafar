import { SubscriptionTier } from './user.types';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  TRIAL = 'trial',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  monthlyFileLimit: number;
  monthlyQuestionLimit: number;
  filesUsedThisMonth: number;
  questionsUsedThisMonth: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId: string;
  stripePaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  invoiceUrl?: string | null;
  createdAt: Date;
}

export interface CreateCheckoutDto {
  plan: SubscriptionTier;
}

export interface CheckoutResponse {
  checkoutUrl: string;
}
