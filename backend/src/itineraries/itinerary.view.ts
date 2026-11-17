import { ItineraryDocument } from './schemas/itinerary.schema';

/** Day dates are never stored: date = startDate + (dayNumber - 1) days (ITN-05). */
export function dayDate(start: Date, dayNumber: number): string {
  return new Date(start.getTime() + (dayNumber - 1) * 86400000).toISOString().slice(0, 10);
}

/** Adds the derived data every client needs: day dates and consecutive same-city groups (ITN-09). */
export function toItineraryView(it: ItineraryDocument) {
  const obj = it.toObject();
  const days = (obj.days ?? []).map((d) => ({ ...d, date: dayDate(obj.startDate, d.dayNumber) }));

  const groups: { city: string; fromDay: number; toDay: number; dayCount: number; startDate: string; endDate: string }[] = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && last.city === d.city) {
      last.toDay = d.dayNumber;
      last.dayCount++;
      last.endDate = d.date;
    } else {
      groups.push({ city: d.city, fromDay: d.dayNumber, toDay: d.dayNumber, dayCount: 1, startDate: d.date, endDate: d.date });
    }
  }
  return { ...obj, days, groups };
}