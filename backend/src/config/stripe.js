import Stripe from 'stripe';
import env from './env.js';

// Pin the API version so that Stripe dashboard changes or SDK upgrades never
// silently change the wire format. Update intentionally when migrating versions.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
});