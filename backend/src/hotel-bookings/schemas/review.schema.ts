import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ _id: false })
export class ReviewReply {
  @Prop({ required: true, maxlength: 1000 })
  text: string;

  /** the hotel moderator who wrote it */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  by: Types.ObjectId;

  @Prop({ required: true })
  repliedAt: Date;
}
export const ReviewReplySchema = SchemaFactory.createForClass(ReviewReply);


@Schema({ timestamps: true })
export class Review {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true,
  })
  hotel: Types.ObjectId;

  /** one review per Completed reservation, whatever the number of rooms */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'HotelBooking',
    required: true,
    unique: true,
  })
  booking: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ maxlength: 1000 })
  comment?: string;

  @Prop({ default: false })
  hidden: boolean; // set by admin moderation (GEN-10)

    /** HTL-26: the hotel's single reply (posting again replaces it) */
  @Prop({ type: ReviewReplySchema })
  reply?: ReviewReply;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
