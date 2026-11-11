import { Connection } from 'mongoose';

/**
 * Reservations that make a room unavailable for [start, end): CONFIRMED ones and PENDING_PAYMENT ones
 * whose hold has not expired yet. Overlap rule: newStart < existingEnd && newEnd > existingStart.
 * Member 5 reuses this function.
 * TODO: remove the try/catch when Member 5 merges the HotelBooking model.
 */
export async function findRoomConflicts(connection: Connection, roomId: any, start: Date, end: Date) {
  try {
    return await connection.model('HotelBooking').find({
      'rooms.room': roomId,
      checkIn: { $lt: end },
      checkOut: { $gt: start },
      $or: [{ status: 'CONFIRMED' }, { status: 'PENDING_PAYMENT', holdExpiresAt: { $gt: new Date() } }],
    });
  } catch {
    return [];
  }
}

export async function roomEverReserved(connection: Connection, roomId: any) {
  try {
    return !!(await connection.model('HotelBooking').exists({ 'rooms.room': roomId }));
  } catch {
    return false;
  }
}
