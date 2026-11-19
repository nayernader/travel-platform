import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true, index: true })
  post: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  // BLG-05: non-empty, at most 500 characters
  @Prop({ required: true, trim: true, maxlength: 500 })
  text: string;

  // GEN-10: hidden by an admin
  @Prop({ default: false })
  hidden: boolean;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
