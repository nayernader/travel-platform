export const BOOKING_REFUND_REQUESTED = 'booking.refund.requested';

/** PAY-03: emitted when a paid booking is cancelled. Member 6 (payments) listens and creates the refund. */
export class BookingRefundRequestedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly paymentId: string,
    public readonly amount: number, // refund amount, already calculated from the tiers
    public readonly currency: string,
  ) {}
}