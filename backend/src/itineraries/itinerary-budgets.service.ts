import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { ItinerariesService } from './itineraries.service';
import { ItineraryDaysService } from './itinerary-days.service';
import { CreateBudgetDto, CreateTransportCostDto, UpdateBudgetDto, UpdateTransportCostDto } from './dto/budget.dto';
import { toItineraryView } from './itinerary.view';
import { UserDocument } from '../users/schemas/user.schema';
import { ReferenceDataService } from '../reference-data/reference-data.service';

const idOf = (x: unknown) => String((x as { _id: unknown })._id);

@Injectable()
export class ItineraryBudgetsService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly days: ItineraryDaysService,
    private readonly ref: ReferenceDataService,
  ) {}

  private async checkCity(city: string) {
    if (!(await this.ref.findCity(city))) throw new BadRequestException(`Unknown city ${city}`);
  }

  // ---------- ITN-14: budget entries ----------

  async addBudget(user: UserDocument, id: string, dayId: string, dto: CreateBudgetDto) {
    const it = await this.its.getOwned(user, id);
    const day = this.days.dayOf(it, dayId);
    day.budgetEntries.push({
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency,
      note: dto.note,
    });
    await it.save();
    return toItineraryView(it);
  }

  /** Looks the entry up inside MY itineraries only: someone else's and a missing one both give 404 (ACC-11). */
  private async locateBudget(user: UserDocument, budgetId: string) {
    if (!isValidObjectId(budgetId)) throw new NotFoundException('Budget entry not found');
    const it = await this.its.model.findOne({ user: user._id, 'days.budgetEntries._id': budgetId });
    if (it) {
      for (const day of it.days) {
        const idx = day.budgetEntries.findIndex((b) => idOf(b) === budgetId);
        if (idx >= 0) return { it, day, idx, entry: day.budgetEntries[idx] };
      }
    }
    throw new NotFoundException('Budget entry not found');
  }

  async updateBudget(user: UserDocument, budgetId: string, dto: UpdateBudgetDto) {
    const { it, entry } = await this.locateBudget(user, budgetId);
    if (dto.category !== undefined) entry.category = dto.category;
    if (dto.amount !== undefined) entry.amount = dto.amount;
    if (dto.currency !== undefined) entry.currency = dto.currency;
    if (dto.note !== undefined) entry.note = dto.note;
    await it.save();
    return toItineraryView(it);
  }

  async removeBudget(user: UserDocument, budgetId: string) {
    const { it, day, idx } = await this.locateBudget(user, budgetId);
    day.budgetEntries.splice(idx, 1);
    await it.save();
    return toItineraryView(it);
  }

  // ---------- ITN-16: intercity transport costs ----------

  async addTransport(user: UserDocument, id: string, dto: CreateTransportCostDto) {
    const it = await this.its.getOwned(user, id);
    const day = this.days.dayOf(it, dto.dayId);
    await this.checkCity(dto.fromCity);
    await this.checkCity(dto.toCity);
    if (dto.fromCity === dto.toCity) throw new BadRequestException('fromCity and toCity must be different');
    day.transports.push({
      mode: dto.mode,
      fromCity: dto.fromCity,
      toCity: dto.toCity,
      amount: dto.amount,
      currency: dto.currency,
    });
    await it.save();
    return toItineraryView(it);
  }

  private async locateTransport(user: UserDocument, transportId: string) {
    if (!isValidObjectId(transportId)) throw new NotFoundException('Transport cost not found');
    const it = await this.its.model.findOne({ user: user._id, 'days.transports._id': transportId });
    if (it) {
      for (const day of it.days) {
        const idx = day.transports.findIndex((t) => idOf(t) === transportId);
        if (idx >= 0) return { it, day, idx, transport: day.transports[idx] };
      }
    }
    throw new NotFoundException('Transport cost not found');
  }

  async updateTransport(user: UserDocument, transportId: string, dto: UpdateTransportCostDto) {
    const { it, day, idx, transport } = await this.locateTransport(user, transportId);

    // validate everything first, so a bad request changes nothing
    const target = dto.dayId && dto.dayId !== idOf(day) ? this.days.dayOf(it, dto.dayId) : undefined;
    if (dto.fromCity !== undefined) await this.checkCity(dto.fromCity);
    if (dto.toCity !== undefined) await this.checkCity(dto.toCity);
    const from = dto.fromCity ?? transport.fromCity;
    const to = dto.toCity ?? transport.toCity;
    if (from === to) throw new BadRequestException('fromCity and toCity must be different');

    if (dto.mode !== undefined) transport.mode = dto.mode;
    transport.fromCity = from;
    transport.toCity = to;
    if (dto.amount !== undefined) transport.amount = dto.amount;
    if (dto.currency !== undefined) transport.currency = dto.currency;

    if (target) {
      // move to another day of the same itinerary, keeping the same _id
      const moved = {
        _id: (transport as unknown as { _id: unknown })._id,
        mode: transport.mode,
        fromCity: transport.fromCity,
        toCity: transport.toCity,
        amount: transport.amount,
        currency: transport.currency,
      };
      day.transports.splice(idx, 1);
      target.transports.push(moved);
    }
    await it.save();
    return toItineraryView(it);
  }

  async removeTransport(user: UserDocument, transportId: string) {
    const { it, day, idx } = await this.locateTransport(user, transportId);
    day.transports.splice(idx, 1);
    await it.save();
    return toItineraryView(it);
  }
}