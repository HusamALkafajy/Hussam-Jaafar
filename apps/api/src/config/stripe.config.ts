import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  proPriceId: process.env.STRIPE_PRO_PRICE_ID,
  institutionPriceId: process.env.STRIPE_INSTITUTION_PRICE_ID,
}));
