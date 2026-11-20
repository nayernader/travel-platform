import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 150 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 20000 })
  body: string;

  // BLG-08: at most 5 tags, 30 characters each (enforced in the DTO)
  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  // BLG-10: image URLs from the shared upload service (GEN-08)
  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String, enum: Object.values(PostStatus), default: PostStatus.DRAFT, index: true })
  status: PostStatus;

  // BLG-06: one entry per user, so a user can like a post only once
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ default: 0 })
  commentCount: number;

  // BLG-13: one of the author's public itineraries attached to the post (optional)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Itinerary', default: null })
  itinerary?: Types.ObjectId | null;

  // GEN-10: a hidden post is visible only to its author and admins
  @Prop({ default: false })
  hidden: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
