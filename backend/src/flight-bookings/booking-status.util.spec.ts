import { BookingStatus } from '../common/enums/booking-status.enum';
import { allowedFrom, canTransition } from './booking-status.util';

const { PENDING_PAYMENT, CONFIRMED, COMPLETED, EXPIRED, CANCELLED } = BookingStatus;

describe('GEN-11 booking lifecycle', () => {
  it('allows the lifecycle changes', () => {
    expect(canTransition(PENDING_PAYMENT, CONFIRMED)).toBe(true);
    expect(canTransition(PENDING_PAYMENT, EXPIRED)).toBe(true);
    expect(canTransition(CONFIRMED, COMPLETED)).toBe(true);
    expect(canTransition(CONFIRMED, CANCELLED)).toBe(true);
  });

  it('blocks every other change', () => {
    expect(canTransition(PENDING_PAYMENT, CANCELLED)).toBe(false);
    expect(canTransition(PENDING_PAYMENT, COMPLETED)).toBe(false);
    expect(canTransition(CONFIRMED, EXPIRED)).toBe(false);
    expect(canTransition(EXPIRED, CONFIRMED)).toBe(false);
    expect(canTransition(CANCELLED, CONFIRMED)).toBe(false);
    expect(canTransition(COMPLETED, CANCELLED)).toBe(false);
  });

  it('knows which statuses may come before each one', () => {
    expect(allowedFrom(EXPIRED)).toEqual([PENDING_PAYMENT]);
    expect(allowedFrom(CONFIRMED)).toEqual([PENDING_PAYMENT]);
    expect(allowedFrom(CANCELLED)).toEqual([CONFIRMED]);
    expect(allowedFrom(PENDING_PAYMENT)).toEqual([]);
  });
});