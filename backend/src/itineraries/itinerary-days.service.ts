import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItinerariesService } from './itineraries.service';
import { AddDayDto, ReorderDayDto, UpdateDayDto } from './dto/day.dto';
import { toItineraryView } from './itinerary.view';
import { ItineraryDocument } from './schemas/itinerary.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { ReferenceDataService } from '../reference-data/reference-data.service';

export const MAX_DAYS = 60;

@Injectable()
export class ItineraryDaysService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly ref: ReferenceDataService,
  ) {}

  /** Days are always numbered 1..n in array order. Dates and city groups are derived by the view. */
  private renumber(it: ItineraryDocument) {
    it.days.forEach((d, i) => {
      d.dayNumber = i + 1;
    });
  }

  private indexOf(it: ItineraryDocument, dayId: string) {
    const i = it.days.findIndex((d) => String((d as unknown as { _id: unknown })._id) === dayId);
    if (i < 0) throw new NotFoundException('Day not found');
    return i;
  }

  /** Used by the activities and budget services too. */
  dayOf(it: ItineraryDocument, dayId: string) {
    return it.days[this.indexOf(it, dayId)];
  }

  private async checkCity(city: string) {
    if (!(await this.ref.findCity(city))) throw new BadRequestException(`Unknown city ${city}`);
  }

  async add(user: UserDocument, id: string, dto: AddDayDto) {
    const it = await this.its.getOwned(user, id);
    if (it.days.length >= MAX_DAYS) throw new BadRequestException(`An itinerary has at most ${MAX_DAYS} days`);
    await this.checkCity(dto.city);
    it.days.push({
      dayNumber: it.days.length + 1,
      city: dto.city,
      notes: dto.notes,
      activities: [],
      budgetEntries: [],
      transports: [],
    });
    await it.save();
    return toItineraryView(it);
  }

  async update(user: UserDocument, id: string, dayId: string, dto: UpdateDayDto) {
    const it = await this.its.getOwned(user, id);
    const day = this.dayOf(it, dayId);
    if (dto.city) {
      await this.checkCity(dto.city);
      day.city = dto.city;
    }
    if (dto.notes !== undefined) day.notes = dto.notes;
    await it.save();
    return toItineraryView(it);
  }

  /** ITN-07: the day's activities and budget entries go with it, so totals follow automatically. */
  async remove(user: UserDocument, id: string, dayId: string) {
    const it = await this.its.getOwned(user, id);
    it.days.splice(this.indexOf(it, dayId), 1);
    this.renumber(it);
    await it.save();
    return toItineraryView(it);
  }

  /** ITN-08: move one day to a new position (1..n). */
  async reorder(user: UserDocument, id: string, dto: ReorderDayDto) {
    const it = await this.its.getOwned(user, id);
    const from = this.indexOf(it, dto.dayId);
    const to = Math.min(dto.position, it.days.length) - 1;
    const [moved] = it.days.splice(from, 1);
    it.days.splice(to, 0, moved);
    this.renumber(it);
    await it.save();
    return toItineraryView(it);
  }
}