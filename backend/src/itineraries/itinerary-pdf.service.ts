import { Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import PDFDocument from 'pdfkit';
import { ItinerariesService } from './itineraries.service';
import { ItinerarySharingService } from './itinerary-sharing.service';
import { ItineraryBudgetSummaryService } from './itinerary-budget-summary.service';
import { ItineraryDocument } from './schemas/itinerary.schema';
import { toItineraryView } from './itinerary.view';
import { UserDocument } from '../users/schemas/user.schema';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { sameId } from '../common/utils/ownership';

const TEAL = '#0f5e5a';
const AMBER = '#d9902a';
const BLACK = '#000000';

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  accommodation: 'Accommodation',
  transport: 'In-city transport',
  activities: 'Activities',
  intercityTransport: 'Intercity transport',
};

const money = (amount: number, currency: string) => `${amount.toFixed(2)} ${currency}`;

@Injectable()
export class ItineraryPdfService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly sharing: ItinerarySharingService,
    private readonly budgets: ItineraryBudgetSummaryService,
    private readonly ref: ReferenceDataService,
  ) {}

  /**
   * ITN-28 access rule. The owner can always export (even private or hidden).
   * Anyone else only gets public, non-hidden itineraries whose owner is active (404 otherwise).
   */
  private async loadAllowed(user: UserDocument, id: string): Promise<ItineraryDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException('Itinerary not found');
    const own = await this.its.model.findById(id);
    if (own && sameId(own.user, user.id)) return own;
    return (await this.sharing.findPublic(id)).it;
  }

  /** ITN-28: the itinerary plan plus its budget summary, as a PDF. */
  async build(user: UserDocument, id: string): Promise<{ fileName: string; pdf: Buffer }> {
    const it = await this.loadAllowed(user, id);
    const view = toItineraryView(it);
    const budget = await this.budgets.summaryFor(user, it); // in the viewer's preferred currency (ITN-18)

    const [cities, countries] = await Promise.all([this.ref.listCities(), this.ref.listCountries()]);
    const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
    const countryName = new Map(countries.map((c) => [String(c._id), c.name]));

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    // header: teal banner with an amber stripe, title in white
    doc.rect(0, 0, doc.page.width, 70).fill(TEAL);
    doc.rect(0, 70, doc.page.width, 4).fill(AMBER);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(it.title, 50, 24, { align: 'center', width: doc.page.width - 100 });
    doc.fillColor(BLACK).font('Helvetica');
    doc.y = 95; // start the body below the banner

    doc.fontSize(11).text(`Countries: ${it.countries.map((c) => countryName.get(c) ?? c).join(', ')}`);
    doc.text(`Start date: ${it.startDate.toISOString().slice(0, 10)}     Days: ${view.days.length}`).moveDown();

    // plan
    doc.fillColor(TEAL).font('Times-Bold').fontSize(15).text('Plan').moveDown(0.3);
    doc.fillColor(BLACK).font('Helvetica');
    for (const d of view.days) {
      doc.fontSize(12).text(`Day ${d.dayNumber}  -  ${d.date}  -  ${cityName.get(d.city) ?? d.city}`);
      if (d.notes) doc.fontSize(10).text(d.notes, { indent: 12 });
      for (const a of d.activities) {
        const when = a.time ? `${a.time}  ` : '';
        const cost = a.cost ? `  (${money(a.cost, a.costCurrency)})` : '';
        doc.fontSize(10).text(`- ${when}${a.name}${cost}`, { indent: 12 });
        if (a.description) doc.text(a.description, { indent: 24 });
      }
      doc.moveDown(0.5);
    }

    // budget (ITN-14, ITN-18)
    doc.moveDown().fillColor(TEAL).font('Times-Bold').fontSize(15).text('Budget').moveDown(0.3);
    doc.fillColor(BLACK).font('Helvetica').fontSize(11);
    const rateDate = budget.rateDate ? new Date(budget.rateDate).toISOString().slice(0, 10) : null;
    doc.text(`Total: ${money(budget.total, budget.currency)}` + (rateDate ? `     (exchange rates of ${rateDate})` : ''));
    doc.moveDown(0.3).text('By category:');
    for (const [key, value] of Object.entries(budget.byCategory)) {
      if (value > 0) doc.fontSize(10).text(`${CATEGORY_LABELS[key] ?? key}: ${money(value, budget.currency)}`, { indent: 12 });
    }
    doc.moveDown(0.3).fontSize(11).text('By day:');
    for (const d of budget.byDay) {
      if (d.total > 0) {
        doc.fontSize(10).text(
          `Day ${d.dayNumber} (${d.date}, ${cityName.get(d.city) ?? d.city}): ${money(d.total, budget.currency)}`,
          { indent: 12 },
        );
      }
    }

    doc.end();
    return { fileName: `itinerary-${it.id}.pdf`, pdf: await done };
  }
}