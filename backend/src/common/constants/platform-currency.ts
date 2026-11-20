/** PAY-04: every flight price, hotel price, payment and refund uses this single currency. */
export const PLATFORM_CURRENCY = (process.env.PLATFORM_CURRENCY ?? 'USD').toUpperCase();