import { CabinClass } from '../flights/schemas/flight.schema';

const LETTERS: Record<CabinClass, string[]> = {
  [CabinClass.FIRST]: ['A', 'C', 'D', 'F'],
  [CabinClass.BUSINESS]: ['A', 'C', 'D', 'F'],
  [CabinClass.PREMIUM_ECONOMY]: ['A', 'B', 'C', 'D', 'E', 'F'],
  [CabinClass.ECONOMY]: ['A', 'B', 'C', 'D', 'E', 'F'],
};

export function normalizeSeat(seat: string): string {
  return seat.trim().toUpperCase();
}

/** Every seat label of a cabin, in order: 1A, 1B, ... The count is exactly totalSeats. */
export function seatLabels(cabinClass: CabinClass, totalSeats: number): string[] {
  const letters = LETTERS[cabinClass];
  const labels: string[] = [];
  for (let i = 0; i < totalSeats; i++) {
    labels.push(`${Math.floor(i / letters.length) + 1}${letters[i % letters.length]}`);
  }
  return labels;
}

/** True when the seat exists in a cabin of this class and size. */
export function isValidSeat(cabinClass: CabinClass, totalSeats: number, seat: string): boolean {
  const match = /^([1-9]\d{0,2})([A-Z])$/.exec(normalizeSeat(seat));
  if (!match) return false;
  const letters = LETTERS[cabinClass];
  const column = letters.indexOf(match[2]);
  if (column === -1) return false;
  return (Number(match[1]) - 1) * letters.length + column < totalSeats;
}