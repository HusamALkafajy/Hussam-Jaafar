import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db, payments, subscriptions, users, eq, and, desc } from '@studyai/database';
import Stripe = require('stripe');
import type { Stripe as StripeCore } from 'stripe/cjs/stripe.core.js';

@Injectable()
export class PaymentsService {
  private readonly stripe: StripeCore;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey')!, {
      apiVersion: '2026-05-27.dahlia',
    });
  }

  async getPaymentHistory(userId: string) {
    return db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret')!;

    let event: StripeCore.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    this.logger.log(`Processing Stripe event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as StripeCore.Checkout.Session);
          break;

        case 'invoice.payment_succeeded':
        case 'invoice.paid': // backwards-compatible alias
          await this.handleInvoicePaid(event.data.object as StripeCore.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as StripeCore.Invoice);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as StripeCore.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as StripeCore.Subscription);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event ${event.type}`, error);
      throw new InternalServerErrorException('Webhook processing failed');
    }

    return { received: true };
  }

  // ──────────────────────────── Event Handlers ────────────────────────────

  private async handleCheckoutCompleted(session: StripeCore.Checkout.Session) {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    const stripeCustomerId = session.customer as string;
    const stripeSubscriptionId = session.subscription as string;

    if (!userId || !plan) {
      this.logger.warn('checkout.session.completed missing userId or plan in metadata');
      return;
    }

    // Determine plan limits
    const { fileLimit, questionLimit } = this.getPlanLimits(plan);

    // Fetch the Stripe subscription for period dates
    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Check if user already has a subscription row
    const existingSub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existingSub.length > 0) {
      // Update existing subscription
      await db
        .update(subscriptions)
        .set({
          plan: plan as any,
          status: 'active',
          stripeCustomerId,
          stripeSubscriptionId,
          monthlyFileLimit: fileLimit,
          monthlyQuestionLimit: questionLimit,
          filesUsedThisMonth: 0,
          questionsUsedThisMonth: 0,
          currentPeriodStart: new Date(stripeSub.items.data[0].current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.items.data[0].current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingSub[0].id));
    } else {
      // Create new subscription
      await db.insert(subscriptions).values({
        userId,
        plan: plan as any,
        status: 'active',
        stripeCustomerId,
        stripeSubscriptionId,
        monthlyFileLimit: fileLimit,
        monthlyQuestionLimit: questionLimit,
        filesUsedThisMonth: 0,
        questionsUsedThisMonth: 0,
        currentPeriodStart: new Date(stripeSub.items.data[0].current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.items.data[0].current_period_end * 1000),
      });
    }

    // Update user subscription tier AND denormalized billing fields
    // Retrieve the price ID from the Stripe subscription for the cache
    const stripePriceId = stripeSub.items.data[0]?.price?.id ?? null;
    await db
      .update(users)
      .set({
        subscriptionTier: plan as any,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
        currentPeriodEnd: new Date(stripeSub.items.data[0].current_period_end * 1000),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Create payment record from the session
    if (session.amount_total) {
      await db.insert(payments).values({
        userId,
        subscriptionId: existingSub.length > 0 ? existingSub[0].id : undefined,
        stripePaymentId: session.payment_intent as string || session.id,
        amount: (session.amount_total / 100).toFixed(2),
        currency: session.currency || 'usd',
        status: 'succeeded',
        invoiceUrl: null,
      });
    }

    this.logger.log(`Checkout completed for user ${userId}, plan: ${plan}`);
  }

  private async handleInvoicePaid(invoice: StripeCore.Invoice) {
    const stripeCustomerId = invoice.customer as string;
    const stripeSubscriptionId = (
      (typeof invoice.parent?.subscription_details?.subscription === 'string'
        ? invoice.parent.subscription_details.subscription
        : (invoice.parent?.subscription_details?.subscription as any)?.id) ||
      (typeof invoice.lines.data[0]?.subscription === 'string'
        ? invoice.lines.data[0].subscription
        : (invoice.lines.data[0]?.subscription as any)?.id)
    ) as string;

    // Find the subscription by Stripe customer ID
    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (sub.length === 0) {
      this.logger.warn(`invoice.paid: No subscription found for customer ${stripeCustomerId}`);
      return;
    }

    const subscription = sub[0];

    // Create payment record
    await db.insert(payments).values({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      stripePaymentId: (
        typeof invoice.payments?.data?.[0]?.payment?.payment_intent === 'string'
          ? invoice.payments.data[0].payment.payment_intent
          : (invoice.payments?.data?.[0]?.payment?.payment_intent as any)?.id
      ) || invoice.id,
      amount: ((invoice.amount_paid || 0) / 100).toFixed(2),
      currency: invoice.currency || 'usd',
      status: 'succeeded',
      invoiceUrl: invoice.hosted_invoice_url || null,
    });

    // Update subscription period if this is a renewal
    if (stripeSubscriptionId) {
      const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      const newPeriodEnd = new Date(stripeSub.items.data[0].current_period_end * 1000);

      await db
        .update(subscriptions)
        .set({
          currentPeriodStart: new Date(stripeSub.items.data[0].current_period_start * 1000),
          currentPeriodEnd: newPeriodEnd,
          filesUsedThisMonth: 0,
          questionsUsedThisMonth: 0,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      // Also sync the denormalized users.currentPeriodEnd for fast quota reads
      await db
        .update(users)
        .set({ currentPeriodEnd: newPeriodEnd, updatedAt: new Date() })
        .where(eq(users.id, subscription.userId));
    }

    this.logger.log(`Invoice paid for user ${subscription.userId}`);
  }

  private async handleInvoicePaymentFailed(invoice: StripeCore.Invoice) {
    const stripeCustomerId = invoice.customer as string;

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (sub.length === 0) {
      this.logger.warn(`invoice.payment_failed: No subscription found for customer ${stripeCustomerId}`);
      return;
    }

    const subscription = sub[0];

    // Create a failed payment record
    await db.insert(payments).values({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      stripePaymentId: (
        typeof invoice.payments?.data?.[0]?.payment?.payment_intent === 'string'
          ? invoice.payments.data[0].payment.payment_intent
          : (invoice.payments?.data?.[0]?.payment?.payment_intent as any)?.id
      ) || invoice.id,
      amount: ((invoice.amount_due || 0) / 100).toFixed(2),
      currency: invoice.currency || 'usd',
      status: 'failed',
      invoiceUrl: invoice.hosted_invoice_url || null,
    });

    this.logger.warn(`Payment failed for user ${subscription.userId}`);
  }

  private async handleSubscriptionUpdated(stripeSub: StripeCore.Subscription) {
    const stripeCustomerId = stripeSub.customer as string;

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (sub.length === 0) {
      this.logger.warn(`subscription.updated: No subscription found for customer ${stripeCustomerId}`);
      return;
    }

    const subscription = sub[0];

    // Map Stripe status to our status
    let status: string;
    if (stripeSub.cancel_at_period_end) {
      status = 'canceled';
    } else if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
      status = stripeSub.status === 'trialing' ? 'trial' : 'active';
    } else {
      status = 'expired';
    }

    await db
      .update(subscriptions)
      .set({
        status: status as any,
        currentPeriodStart: new Date(stripeSub.items.data[0].current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.items.data[0].current_period_end * 1000),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    this.logger.log(`Subscription updated for user ${subscription.userId}, status: ${status}`);
  }

  private async handleSubscriptionDeleted(stripeSub: StripeCore.Subscription) {
    const stripeCustomerId = stripeSub.customer as string;

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (sub.length === 0) {
      this.logger.warn(`subscription.deleted: No subscription found for customer ${stripeCustomerId}`);
      return;
    }

    const subscription = sub[0];

    // Set subscription to expired and reset limits to free
    await db
      .update(subscriptions)
      .set({
        status: 'expired',
        plan: 'free',
        stripeSubscriptionId: null,
        monthlyFileLimit: 5,
        monthlyQuestionLimit: 100,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    // Downgrade user to free tier and clear denormalized billing cache
    await db
      .update(users)
      .set({
        subscriptionTier: 'free',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        // Keep stripeCustomerId so repeat purchases don't create duplicate Stripe customers
        updatedAt: new Date(),
      })
      .where(eq(users.id, subscription.userId));

    this.logger.log(`Subscription deleted for user ${subscription.userId}, downgraded to free`);
  }

  // ──────────────────────────── Helpers ────────────────────────────

  private getPlanLimits(plan: string): { fileLimit: number; questionLimit: number } {
    switch (plan) {
      case 'pro':
        return { fileLimit: 100, questionLimit: -1 }; // -1 = unlimited
      case 'institution':
        return { fileLimit: -1, questionLimit: -1 }; // -1 = unlimited
      default:
        return { fileLimit: 5, questionLimit: 100 };
    }
  }
}
