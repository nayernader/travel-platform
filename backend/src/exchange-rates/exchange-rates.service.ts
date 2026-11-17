import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { ExchangeRate, ExchangeRateDocument } from './schemas/exchange-rate.schema';
import { SUPPORTED_CURRENCIES } from '../common/constants/currencies';
import { PLATFORM_CURRENCY } from '../common/constants/platform-currency';

@Injectable()
export class ExchangeRatesService implements OnModuleInit {
  private log = new Logger(ExchangeRatesService.name);

  constructor(@InjectModel(ExchangeRate.name) private model: Model<ExchangeRateDocument>) {}

  async onModuleInit() {
    await this.refreshIfStale();
  }

  @Cron('0 3 * * *') // once per day at 03:00
  async refreshDaily() {
    await this.fetchAndStore();
  }

  private async refreshIfStale() {
    const latest = await this.model.findOne().sort({ fetchedAt: -1 });
    if (!latest || Date.now() - latest.fetchedAt.getTime() > 24 * 3600 * 1000) {
      await this.fetchAndStore();
    }
  }

  /** If the API is unavailable we keep using the last cached rates. */
  async fetchAndStore() {
    const url = process.env.EXCHANGE_RATE_API_URL;
    if (!url) {
      this.log.warn('EXCHANGE_RATE_API_URL is missing in .env, using cached rates only');
      return null;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      const all: Record<string, number> = json.rates ?? json.conversion_rates;
      if (!all) throw new Error('Response has no rates object');
      const rates: Record<string, number> = {};
      for (const c of SUPPORTED_CURRENCIES) {
        if (all[c] !== undefined) rates[c] = all[c];
      }
      rates[PLATFORM_CURRENCY] = 1;
      return await this.model.create({
        base: PLATFORM_CURRENCY,
        rates,
        rateDate: new Date().toISOString().slice(0, 10),
        fetchedAt: new Date(),
      });
    } catch (e) {
      this.log.warn(`Exchange-rate fetch failed, using cached rates: ${(e as Error).message}`);
      return null;
    }
  }

  async latest() {
    const doc = await this.model.findOne().sort({ fetchedAt: -1 });
    if (!doc) {
      await this.fetchAndStore();
      return this.model.findOne().sort({ fetchedAt: -1 });
    }
    return doc;
  }

  /** Converts an amount between two supported currencies, going through the base currency. */
  async convert(amount: number, from: string, to: string) {
    const doc = await this.latest();
    if (!doc) throw new BadRequestException('No exchange rates available yet');
    const rate = (c: string) => {
      const r = doc.rates[c];
      if (!r) throw new BadRequestException(`Unsupported currency ${c}`);
      return r;
    };
    const converted = (amount / rate(from)) * rate(to);
    return { amount: Math.round(converted * 100) / 100, rateDate: doc.rateDate };
  }
}