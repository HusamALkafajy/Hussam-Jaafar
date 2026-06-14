import type { Stripe as StripeCore } from 'stripe/cjs/stripe.core.js';

type KeysOfSub = keyof StripeCore.Subscription;
type KeysOfInvoice = keyof StripeCore.Invoice;

const subKeys: KeysOfSub[] = [];
const invoiceKeys: KeysOfInvoice[] = [];

console.log(subKeys, invoiceKeys);
