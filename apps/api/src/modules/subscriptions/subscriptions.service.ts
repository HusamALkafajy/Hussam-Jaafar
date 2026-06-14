import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
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

    // Map plan to Stripe price ID
    const priceId = this.getPriceIdForPlan(plan);

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
        success_url: `${this.configService.get<string>('app.frontendUrl')}/dashboard/subscription?success=true`,
        cancel_url: `${this.configService.get<string>('app.frontendUrl')}/dashboard/subscription?canceled=true`,
        metadata: {
          userId,
          plan,
        },
      });

      return { checkoutUrl: session.url! };
    } catch (error) {
      this.logger.error('Failed to create Stripe checkout session', error);
      throw new InternalServerErrorException('Failed to create checkout session');
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
      case SubscriptionTier.PRO:
        return this.configService.get<string>('stripe.proPriceId')!;
      case SubscriptionTier.INSTITUTION:
        return this.configService.get<string>('stripe.institutionPriceId')!;
      default:
        throw new BadRequestException(`Invalid plan: ${plan}`);
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
