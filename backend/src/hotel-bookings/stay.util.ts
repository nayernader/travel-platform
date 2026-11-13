/** Dates are whole days at UTC midnight. A stay is [checkIn, checkOut): check-out day is not a
    night. */
export function parseDay(s: string): Date { return new Date(`${s.slice(0, 10)}T00:00:00.000Z`); }
export function today(): Date { return parseDay(new Date().toISOString()); }
export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  for (let d = new Date(checkIn); d < checkOut; d = new Date(d.getTime() + 86400000))
      nights.push(new Date(d));
  return nights;
}
export const nightsBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) /
    86400000);
export const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start <
    b.end && a.end > b.start;