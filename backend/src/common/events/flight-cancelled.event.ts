export const FLIGHT_CANCELLED = 'flight.cancelled';

/** FLT-06: emitted when a moderator cancels a flight. FlightBookingsService reacts to it. */
export class FlightCancelledEvent {
  constructor(
    public readonly flightId: string,
    public readonly flightNumber: string,
    public readonly route: string, // e.g. "CAI to DXB"
    public readonly departureTimeUtc: Date,
  ) {}
}