import { CabinClass } from '../flights/schemas/flight.schema';
import { isValidSeat, seatLabels } from './seat-layout.util';

describe('seat layout', () => {
  it('numbers Economy seats 6 per row and stops at totalSeats', () => {
    expect(seatLabels(CabinClass.ECONOMY, 8)).toEqual(['1A', '1B', '1C', '1D', '1E', '1F', '2A', '2B']);
  });

  it('uses A C D F in Business', () => {
    expect(seatLabels(CabinClass.BUSINESS, 5)).toEqual(['1A', '1C', '1D', '1F', '2A']);
  });

  it('accepts only seats that exist', () => {
    expect(isValidSeat(CabinClass.ECONOMY, 8, '2B')).toBe(true);
    expect(isValidSeat(CabinClass.ECONOMY, 8, '2b')).toBe(true); // case-insensitive
    expect(isValidSeat(CabinClass.ECONOMY, 8, '2C')).toBe(false); // beyond totalSeats
    expect(isValidSeat(CabinClass.ECONOMY, 8, '1G')).toBe(false); // no such column
    expect(isValidSeat(CabinClass.BUSINESS, 8, '1B')).toBe(false); // Business has no B
    expect(isValidSeat(CabinClass.ECONOMY, 8, '0A')).toBe(false);
    expect(isValidSeat(CabinClass.ECONOMY, 8, '01A')).toBe(false);
    expect(isValidSeat(CabinClass.ECONOMY, 8, '')).toBe(false);
  });
});