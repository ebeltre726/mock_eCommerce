import Stripe from 'stripe';

// Read directly from process.env rather than the env.js snapshot: the snapshot
// is captured before SSM secrets are loaded, so env.STRIPE_SECRET_KEY is empty
// at that point. By the time this module is imported (inside getHandler() after
// SSM has run), process.env.STRIPE_SECRET_KEY holds the real key.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
});