import { refundPercentFor } from './cancellation.util';

describe('refundPercentFor', () => {
  const tiers = [
    { daysBefore: 14, refundPercent: 100 },
    { daysBefore: 7, refundPercent: 50 },
  ];

  it('uses the highest threshold not above days remaining', () => {
    expect(refundPercentFor(tiers, 20)).toBe(100);
    expect(refundPercentFor(tiers, 10)).toBe(50);
  });

  it('returns 0 when no tier applies', () => {
    expect(refundPercentFor(tiers, 3)).toBe(0);
  });

  it('returns 0 when there are no tiers', () => {
    expect(refundPercentFor([], 10)).toBe(0);
  });
});