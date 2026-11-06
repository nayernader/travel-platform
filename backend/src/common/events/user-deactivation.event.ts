/**
 * ACC-12 contract between Users and the booking modules.
 *
 * Before a user deactivates their account, UsersService emits this event with emitAsync().
 * Every listener returns a NUMBER: how many future Confirmed bookings the user has in that module.
 * If the total is above 0, deactivation is refused with 409 HAS_FUTURE_BOOKINGS.
 *
 * Booking members add a listener like this in their service:
 *
 *   @OnEvent(USER_DEACTIVATION_CHECK, { suppressErrors: false })
 *   countFutureConfirmed({ userId }: UserDeactivationCheckPayload): Promise<number> {
 *     return this.model.countDocuments({
 *       userId,
 *       status: BookingStatus.CONFIRMED,
 *       checkIn: { $gt: new Date() }, // use your own "starts in the future" field
 *     });
 *   }
 */
export const USER_DEACTIVATION_CHECK = 'user.deactivation.check';

export interface UserDeactivationCheckPayload {
  userId: string;
}