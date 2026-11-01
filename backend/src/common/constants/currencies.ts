// Distinct currencies from the official Countries reference data (GEN-12)
export const SUPPORTED_CURRENCIES = ['EGP', 'AED', 'GBP', 'USD', 'EUR', 'JPY', 'SAR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];