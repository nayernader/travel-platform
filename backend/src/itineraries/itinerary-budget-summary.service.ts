import { Injectable } from '@nestjs/common';
import { ItinerariesService } from './itineraries.service';
import { toItineraryView } from './itinerary.view';
import { UserDocument } from '../users/schemas/user.schema';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { SUPPORTED_CURRENCIES } from '../common/constants/currencies';
import { PLATFORM_CURRENCY } from '../common/constants/platform-currency';
import { ItineraryDocument } from './schemas/itinerary.schema';

/** The four budget categories plus intercity transport (ITN-16), so every cost has a home. */
const CATEGORIES = ['food', 'accommodation', 'transport', 'activities', 'intercityTransport'];

const round2 = (n: number) => Math.round(n * 100) / 100;
const emptyTotals = (): Record<string, number> => Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
const roundAll = (t: Record<string, number>) =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, round2(v)]));

@Injectable()
export class ItineraryBudgetSummaryService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly rates: ExchangeRatesService,
  ) {}

  /** ITN-14, ITN-18: totals by category, by day and by city group, in the user's preferred currency. */
    async summary(user: UserDocument, id: string) {
    return this.summaryFor(user, await this.its.getOwned(user, id));
  }

  /** Same totals for an itinerary the caller already loaded and access-checked (used by the ITN-28 export). */
  async summaryFor(user: UserDocument, it: ItineraryDocument) {
    const view = toItineraryView(it);

    // ACC-09: show everything in the user's preferred currency
    const target = (SUPPORTED_CURRENCIES as readonly string[]).includes(user.preferredCurrency)
      ? user.preferredCurrency
      : PLATFORM_CURRENCY;

    // 1) add up the ORIGINAL amounts per day, category and currency
    const sums = new Map<string, { day: number; category: string; currency: string; amount: number }>();
    const add = (day: number, category: string, currency: string, amount?: number) => {
      if (!amount) return; // no cost, nothing to add
      const key = `${day}|${category}|${currency}`;
      const row = sums.get(key) ?? { day, category, currency, amount: 0 };
      row.amount += amount;
      sums.set(key, row);
    };
    it.days.forEach((d, i) => {
      d.budgetEntries.forEach((b) => add(i, b.category, b.currency, b.amount));
      // activity costs count under Activities (ITN-14)
      d.activities.forEach((a) => add(i, 'activities', a.costCurrency, a.cost));
      // intercity transport costs (ITN-16)
      d.transports.forEach((t) => add(i, 'intercityTransport', t.currency, t.amount));
    });

    // 2) convert each sum once. Everything below is built from these converted values,
    //    so the totals by day, by category and overall always agree.
    const latest = await this.rates.latest();
    const days = view.days.map((d) => ({
      dayId: String((d as unknown as { _id: unknown })._id),
      dayNumber: d.dayNumber,
      date: d.date,
      city: d.city,
      total: 0,
      byCategory: emptyTotals(),
    }));
    const byCategory = emptyTotals();
    let total = 0;
    for (const s of sums.values()) {
      const value =
        s.currency === target ? s.amount : (await this.rates.convert(s.amount, s.currency, target)).amount;
      days[s.day].byCategory[s.category] += value;
      days[s.day].total += value;
      byCategory[s.category] += value;
      total += value;
    }

    // 3) ITN-09: budget subtotal for each group of consecutive days in the same city
    const byGroup = view.groups.map((g) => ({
      ...g,
      subtotal: round2(
        days.filter((d) => d.dayNumber >= g.fromDay && d.dayNumber <= g.toDay).reduce((sum, d) => sum + d.total, 0),
      ),
    }));

    return {
      itineraryId: it.id,
      currency: target,
      rateDate: latest?.rateDate ?? null,
      total: round2(total),
      byCategory: roundAll(byCategory),
      byDay: days.map((d) => ({ ...d, total: round2(d.total), byCategory: roundAll(d.byCategory) })),
      byGroup,
    };
  }
}
