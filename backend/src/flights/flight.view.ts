import { DateTime } from 'luxon';

type AirportLike = { timezone?: string | null };

/** GEN-06: every flight sent to a client carries local times in each airport's time zone. */
export function toFlightView(
  flight: any,
  dep: AirportLike | null | undefined,
  arr: AirportLike | null | undefined,
) {
  const obj = typeof flight.toObject === 'function' ? flight.toObject() : flight;
  const depZone = dep?.timezone || 'UTC';
  const arrZone = arr?.timezone || 'UTC';

  const fmt = (d: Date, zone: string) =>
    DateTime.fromJSDate(d, { zone: 'utc' })
      .setZone(zone)
      .toFormat("yyyy-LL-dd'T'HH:mm");

  return {
    ...obj,
    departureLocal: fmt(obj.departureTimeUtc, depZone),
    departureTimeZone: depZone,
    arrivalLocal: fmt(obj.arrivalTimeUtc, arrZone),
    arrivalTimeZone: arrZone,
  };
}