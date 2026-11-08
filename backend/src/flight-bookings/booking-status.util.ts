import { BookingStatus } from '../common/enums/booking-status.enum';

/** GEN-11: the only allowed status changes for a booking. */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING_PAYMENT]: [BookingStatus.CONFIRMED, BookingStatus.EXPIRED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.EXPIRED]: [],
  [BookingStatus.CANCELLED]: [],
};

/** True if a booking may go from `from` to `to`. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** All statuses a booking may be in right before it becomes `to`. */
export function allowedFrom(to: BookingStatus): BookingStatus[] {
  return (Object.keys(ALLOWED_TRANSITIONS) as BookingStatus[]).filter((from) =>
    canTransition(from, to),
  );
}