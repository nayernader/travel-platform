export interface Tier {
  daysBefore: number;
  refundPercent: number;
}

/**
 * FLT-09: use the tier with the HIGHEST threshold that does not exceed the days remaining.
 * If no tier applies, the refund is 0 percent.
 */
export function refundPercentFor(tiers: Tier[], daysRemaining: number): number {
  const applicable = tiers
    .filter((t) => t.daysBefore <= daysRemaining)
    .sort((a, b) => b.daysBefore - a.daysBefore);
  return applicable.length ? applicable[0].refundPercent : 0;
}