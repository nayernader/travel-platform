import { BadRequestException, Injectable } from '@nestjs/common';
import { ItinerariesService } from './itineraries.service';
import { toItineraryView } from './itinerary.view';
import { ItineraryFlightsQueryDto, ItineraryHotelsQueryDto, TripType } from './dto/suggestions.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { HotelSearchService } from '../hotels/hotel-search.service';
import { SearchHotelsDto } from '../hotels/dto/search-hotels.dto';
import { FlightsService } from '../flights/flights.service';
import { SearchFlightsDto } from '../flights/dto/search-flights.dto';

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86400000).toISOString().slice(0, 10);

@Injectable()
export class ItinerarySuggestionsService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly ref: ReferenceDataService,
    private readonly hotelSearch: HotelSearchService,
    private readonly flightSearch: FlightsService,
  ) {}

  /**
   * ITN-25: hotels for one city group. Check-in = date of the group's first day,
   * check-out = the day after its last day. Guests, rooms and filters come from the caller.
   */
  async hotels(user: UserDocument, id: string, q: ItineraryHotelsQueryDto) {
    const it = await this.its.getOwned(user, id);
    const { groups } = toItineraryView(it);
    const g = groups[q.group - 1];
    if (!g) {
      throw new BadRequestException(
        groups.length
          ? `This itinerary has ${groups.length} city group(s)`
          : 'Add at least one day to the itinerary first',
      );
    }
    const checkIn = g.startDate;
    const checkOut = addDays(g.endDate, 1);

    const dto = Object.assign(new SearchHotelsDto(), q, { city: g.city, checkIn, checkOut });
    const result = await this.hotelSearch.search(dto); // reuses HTL-11, HTL-12

    return {
      group: {
        number: q.group,
        city: g.city,
        fromDay: g.fromDay,
        toDay: g.toDay,
        dayCount: g.dayCount,
        checkIn,
        checkOut,
      },
      ...result,
    };
  }

  /**
   * ITN-26: flights from the chosen origin airport to ANY airport in the city of the first day.
   * One search per destination airport, so each airport has its own sorted and paged result.
   */
  async flights(user: UserDocument, id: string, q: ItineraryFlightsQueryDto) {
    const it = await this.its.getOwned(user, id);
    const { days } = toItineraryView(it);
    if (!days.length) throw new BadRequestException('Add at least one day to the itinerary first');

    const first = days[0];
    const last = days[days.length - 1];
    const date = q.date ?? first.date; // default: the start date
    const roundTrip = q.tripType === TripType.ROUND_TRIP;
    const returnDate = roundTrip ? (q.returnDate ?? last.date) : undefined; // default: the last day

    const airports = (await this.ref.listAirports(first.city)).filter((a) => a._id !== q.originAirport);
    if (!airports.length) throw new BadRequestException(`No other airport found in ${first.city}`);

    const destinations: { airport: string; name: string; results: unknown }[] = [];
    for (const a of airports) {
      const dto = Object.assign(new SearchFlightsDto(), q, {
        departureAirport: q.originAirport,
        arrivalAirport: a._id,
        date,
        returnDate,
      });
      const results = await this.flightSearch.search(dto); // FLT-11, FLT-12
      destinations.push({ airport: a._id, name: a.name, results });
    }

    return {
      originAirport: q.originAirport,
      destinationCity: first.city,
      tripType: q.tripType,
      date,
      returnDate: returnDate ?? null,
      destinations,
    };
  }
}
