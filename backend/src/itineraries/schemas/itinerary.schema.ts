import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { SUPPORTED_CURRENCIES } from '../../common/constants/currencies';

export type ItineraryDocument = HydratedDocument<Itinerary>;

export enum Visibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

export enum BudgetCategory {
  FOOD = 'food',
  ACCOMMODATION = 'accommodation',
  TRANSPORT = 'transport', // in-city transport
  ACTIVITIES = 'activities',
}

// ITN-12: each image has its own _id so it can be removed by id
@Schema()
export class ActivityImage {
  @Prop({ required: true })
  url: string;
}
export const ActivityImageSchema = SchemaFactory.createForClass(ActivityImage);

@Schema()
export class Activity {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop() // HH:mm, optional
  time?: string;

  @Prop({ min: 0 }) // optional, counted under Activities (ITN-14)
  cost?: number;

  @Prop({ type: String, enum: [...SUPPORTED_CURRENCIES], default: 'USD' })
  costCurrency: string;

  @Prop({ type: [ActivityImageSchema], default: [] })
  images: ActivityImage[];
}
export const ActivitySchema = SchemaFactory.createForClass(Activity);

@Schema()
export class BudgetEntry {
  @Prop({ required: true, enum: Object.values(BudgetCategory) })
  category: BudgetCategory;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, enum: [...SUPPORTED_CURRENCIES] })
  currency: string;

  @Prop({ trim: true, maxlength: 200 })
  note?: string;
}
export const BudgetEntrySchema = SchemaFactory.createForClass(BudgetEntry);

@Schema() // intercity transport (ITN-16)
export class TransportCost {
  @Prop({ required: true, trim: true })
  mode: string;

  @Prop({ required: true })
  fromCity: string;

  @Prop({ required: true })
  toCity: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, enum: [...SUPPORTED_CURRENCIES] })
  currency: string;
}
export const TransportCostSchema = SchemaFactory.createForClass(TransportCost);

@Schema()
export class Day {
  @Prop({ required: true })
  dayNumber: number;

  @Prop({ required: true }) // reference-data city id: a day must have a city (ITN-09)
  city: string;

  @Prop({ trim: true, maxlength: 2000 })
  notes?: string;

  @Prop({ type: [ActivitySchema], default: [] })
  activities: Activity[];

  @Prop({ type: [BudgetEntrySchema], default: [] })
  budgetEntries: BudgetEntry[];

  @Prop({ type: [TransportCostSchema], default: [] })
  transports: TransportCost[];
}
export const DaySchema = SchemaFactory.createForClass(Day);

@Schema({ timestamps: true })
export class Itinerary {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  @Prop({ type: [String], required: true })
  countries: string[];

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ enum: Object.values(Visibility), default: Visibility.PRIVATE, index: true })
  visibility: Visibility;

  @Prop({ type: [DaySchema], default: [] })
  days: Day[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) // set on clones (ITN-21)
  originalAuthor?: Types.ObjectId;

  @Prop({ default: false }) // admin moderation (GEN-10, Member 8)
  hidden: boolean;
}
export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);