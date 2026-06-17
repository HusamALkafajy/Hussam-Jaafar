import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db, subscriptions, users, eq, and } from '@studyai/database';
import { SubscriptionTier, SubscriptionStatus } from '@studyai/types';
import Stripe = require('stripe');
import type { Stripe as StripeCore } from 'stripe/cjs/stripe.core.js';

@Injectable()
export class SubscriptionsService {
  private readonly stripe: StripeCore;
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey')!, {
      apiVersion: '2026-05-27.dahlia',
    });
  }

  async getCurrentSubscription(userId: string) {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (result.length === 0) {
      // Return a default free subscription view if none exists
      return {
        userId,
        plan: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        monthlyFileLimit: 5,
        monthlyQuestionLimit: 100,
        filesUsedThisMonth: 0,
        questionsUsedThisMonth: 0,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEndsAt: null,
      };
    }

    return result[0];
  }

  async createCheckout(userId: string, plan: SubscriptionTier) {
    if (plan === SubscriptionTier.FREE) {
      throw new BadRequestException('Cannot create a checkout session for the free plan');
    }

    // ── Guard 1: Stripe secret key must be present ─────────────────────────
    const secretKey = this.configService.get<string>('stripe.secretKey');
    if (!secretKey) {
      this.logger.error('STRIPE_SECRET_KEY is not set in environment variables');
      throw new InternalServerErrorException(
        'Payment service is not configured: STRIPE_SECRET_KEY is missing. Please contact support.',
      );
    }

    // ── Guard 2: Price ID must be set for the requested plan ───────────────
    const priceId = this.getPriceIdForPlan(plan); // throws BadRequestException if missing

    // ── Guard 3: Frontend URL must be configured for redirect URLs ─────────
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    if (!frontendUrl) {
      this.logger.error('FRONTEND_URL is not set in environment variables');
      throw new InternalServerErrorException(
        'Server misconfiguration: FRONTEND_URL is missing.',
      );
    }

    // Look up user email for Stripe customer creation
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult[0];

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, user.email);

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${frontendUrl}/dashboard/subscription?success=true`,
        cancel_url: `${frontendUrl}/dashboard/subscription?canceled=true`,
        metadata: {
          userId,
          plan,
        },
      });

      return { checkoutUrl: session.url! };
    } catch (error: any) {
      // ── Stripe error type-narrowing ──────────────────────────────────────
      // Stripe SDK wraps all API errors in a StripeError subclass with a `type` field.
      if (error?.type) {
        const stripeType: string = error.type;
        const stripeCode: string = error.code || '';
        const stripeMessage: string = error.message || 'Unknown Stripe error';

        this.logger.error(`Stripe error [${stripeType}] code=${stripeCode}: ${stripeMessage}`);

        // Authentication failure → invalid or missing API key
        if (stripeType === 'StripeAuthenticationError') {
          throw new UnauthorizedException(
            'Stripe authentication failed: your STRIPE_SECRET_KEY is invalid or expired. ' +
            'Use a key starting with sk_test_ for test mode.',
          );
        }

        // Invalid request → usually wrong price ID or missing param
        if (stripeType === 'StripeInvalidRequestError') {
          if (stripeCode === 'resource_missing' || stripeMessage.includes('No such price')) {
            throw new BadRequestException(
              `Invalid Stripe Price ID for plan "${plan}": "${priceId}". ` +
              'Check STRIPE_PRO_PRICE_ID / STRIPE_INSTITUTION_PRICE_ID in your .env and ensure ' +
              'the price exists in your Stripe dashboard (test vs live mode must match the key).',
            );
          }
          // Generic invalid request
          throw new HttpException(
            `Stripe rejected the request: ${stripeMessage}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        // Rate limiting
        if (stripeType === 'StripeRateLimitError') {
          throw new HttpException(
            'Stripe rate limit exceeded. Please wait a moment and try again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // Network / connection failure (transient)
        if (stripeType === 'StripeConnectionError' || stripeType === 'StripeAPIError') {
          throw new InternalServerErrorException(
            'Could not reach the Stripe API. Check your internet connection or Stripe status at https://status.stripe.com.',
          );
        }

        // All other Stripe errors
        throw new InternalServerErrorException(
          `Stripe error (${stripeType}): ${stripeMessage}`,
        );
      }

      // Non-Stripe exception (e.g. DB failure during customer creation)
      this.logger.error('Unexpected error during checkout session creation', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the checkout session. Please try again.',
      );
    }
  }

  async cancelSubscription(userId: string) {
    const sub = await this.findActiveSubscription(userId);

    if (!sub.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription found to cancel');
    }

    try {
      await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));

      return { message: 'Subscription will be canceled at the end of the billing period' };
    } catch (error) {
      this.logger.error('Failed to cancel subscription', error);
      throw new InternalServerErrorException('Failed to cancel subscription');
    }
  }

  async resumeSubscription(userId: string) {
    const sub = await this.findCanceledSubscription(userId);

    if (!sub.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription found to resume');
    }

    try {
      await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      await db
        .update(subscriptions)
        .set({
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));

      return { message: 'Subscription has been resumed' };
    } catch (error) {
      this.logger.error('Failed to resume subscription', error);
      throw new InternalServerErrorException('Failed to resume subscription');
    }
  }

  async createPortalSession(userId: string) {
    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (sub.length === 0 || !sub[0].stripeCustomerId) {
      throw new NotFoundException('No subscription found. Please subscribe first.');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: sub[0].stripeCustomerId,
        return_url: `${this.configService.get<string>('app.frontendUrl')}/dashboard/subscription`,
      });

      return { portalUrl: session.url };
    } catch (error) {
      this.logger.error('Failed to create portal session', error);
      throw new InternalServerErrorException('Failed to create billing portal session');
    }
  }

  // ──────────────────────────── Private Helpers ────────────────────────────

  private async getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
    // Check if user already has a Stripe customer ID in subscriptions
    const existingSub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existingSub.length > 0 && existingSub[0].stripeCustomerId) {
      return existingSub[0].stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await this.stripe.customers.create({
      email,
      metadata: { userId },
    });

    // If a subscription row already exists (e.g. free/trial), update it with the customer ID
    if (existingSub.length > 0) {
      await db
        .update(subscriptions)
        .set({
          stripeCustomerId: customer.id,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingSub[0].id));
    } else {
      // Create a new subscription row for the user
      await db.insert(subscriptions).values({
        userId,
        plan: 'free',
        status: 'active',
        stripeCustomerId: customer.id,
        monthlyFileLimit: 5,
        monthlyQuestionLimit: 100,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });
    }

    return customer.id;
  }

  private getPriceIdForPlan(plan: SubscriptionTier): string {
    switch (plan) {
      case SubscriptionTier.PRO: {
        const id = this.configService.get<string>('stripe.proPriceId');
        if (!id) {
          this.logger.error('STRIPE_PRO_PRICE_ID is not set in environment variables');
          throw new InternalServerErrorException(
            'Payment service misconfiguration: STRIPE_PRO_PRICE_ID is missing. ' +
            'Add it to your .env file (e.g. price_xxx from your Stripe dashboard).',
          );
        }
        return id;
      }
      case SubscriptionTier.INSTITUTION: {
        const id = this.configService.get<string>('stripe.institutionPriceId');
        if (!id) {
          this.logger.error('STRIPE_INSTITUTION_PRICE_ID is not set in environment variables');
          throw new InternalServerErrorException(
            'Payment service misconfiguration: STRIPE_INSTITUTION_PRICE_ID is missing. ' +
            'Add it to your .env file (e.g. price_xxx from your Stripe dashboard).',
          );
        }
        return id;
      }
      default:
        throw new BadRequestException(`Invalid or unsupported plan: ${plan}`);
    }
  }

  private async findActiveSubscription(userId: string) {
    const result = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('No active subscription found');
    }

    return result[0];
  }

  private async findCanceledSubscription(userId: string) {
    const result = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'canceled'),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('No canceled subscription found to resume');
    }

    return result[0];
  }
}
