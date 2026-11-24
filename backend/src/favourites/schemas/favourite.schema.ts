import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FavouriteDocument = HydratedDocument<Favourite>;

export enum FavouriteType {
  HOTEL = 'hotel',
  ITINERARY = 'itinerary',
}

/** BON-02: one saved hotel or public itinerary of one user. */
@Schema({ timestamps: true })
export class Favourite {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(FavouriteType) })
  type: FavouriteType;

  // The hotel _id or the itinerary _id, depending on type
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  item: Types.ObjectId;
}

export const FavouriteSchema = SchemaFactory.createForClass(Favourite);

// The same item cannot be saved twice by the same user
FavouriteSchema.index({ user: 1, type: 1, item: 1 }, { unique: true });
