import { Provider } from '@nestjs/common';
import Stripe from 'stripe';

export const STRIPE = 'STRIPE_CLIENT';

export const stripeProvider: Provider = {
  provide: STRIPE,
  useFactory: () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is missing in backend/.env');
    return new Stripe(key);
  },
};