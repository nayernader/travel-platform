import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import type { UserDocument } from '../users/schemas/user.schema';
import { Itinerary, ItineraryDocument, Visibility } from '../itineraries/schemas/itinerary.schema';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';

export const excerpt = (body: string) => (body.length > 160 ? body.slice(0, 157) + '...' : body);

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) public posts: Model<PostDocument>,
    @InjectModel(Comment.name) public comments: Model<CommentDocument>,
    @InjectModel(Itinerary.name) private itineraries: Model<ItineraryDocument>,
  ) {}

  // BLG-01: create as DRAFT (default) or PUBLISHED
  create(user: UserDocument, dto: CreatePostDto) {
    return this.posts.create({ ...dto, author: user._id, status: dto.status ?? PostStatus.DRAFT });
  }

  /** Ownership check shared by edit, delete and images (BLG-04, BLG-10). */
  async getOwned(user: UserDocument, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id format');
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    if (post.author.toString() !== user.id) throw new ForbiddenException('Not your post');
    return post;
  }

  // BLG-04, BLG-08: edit title, body, tags or status
  async update(user: UserDocument, id: string, dto: UpdatePostDto) {
    const post = await this.getOwned(user, id);
    // Only the fields that were sent: the DTO instance also carries undefined keys for the others
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) post.set(key, value);
    }
    return post.save();
  }

  /**
   * BLG-13: attach one of MY public, non-hidden itineraries to MY post, or detach it with null.
   * Another user's itinerary answers 404 (same as the rest of the API); a private or hidden one 400.
   */
  async attachItinerary(user: UserDocument, id: string, itineraryId: string | null) {
    const post = await this.getOwned(user, id);
    if (itineraryId === null) {
      post.itinerary = null;
      return post.save();
    }
    const it = await this.itineraries.findById(itineraryId).select('user visibility hidden');
    if (!it || it.user.toString() !== user.id) throw new NotFoundException('Itinerary not found');
    if (it.hidden) throw new BadRequestException('This itinerary was hidden by an administrator');
    if (it.visibility !== Visibility.PUBLIC) {
      throw new BadRequestException('Only public itineraries can be attached to a post');
    }
    post.itinerary = it._id;
    return post.save();
  }

  // BLG-04: deleting a post also deletes its comments
  async remove(user: UserDocument, id: string) {
    const post = await this.getOwned(user, id);
    await this.comments.deleteMany({ post: post._id });
    await post.deleteOne();
    return { deleted: true };
  }

  /** BLG-03: my posts including drafts, with like and comment counts. */
  async mine(user: UserDocument, page = 1) {
    const filter = { author: user._id };
    const [items, total] = await Promise.all([
      this.posts.find(filter).sort({ createdAt: -1 }).skip(getSkip(page)).limit(PAGE_SIZE),
      this.posts.countDocuments(filter),
    ]);
    const rows = items.map((p) => ({
      _id: p.id,
      title: p.title,
      status: p.status,
      createdAt: (p as any).createdAt,
      hidden: p.hidden,
      tags: p.tags,
      likeCount: p.likes.length,
      commentCount: p.commentCount,
    }));
    return buildPage(rows, total, page);
  }

  // One of my posts, including drafts and hidden ones
  mineOne(user: UserDocument, id: string) {
    return this.getOwned(user, id);
  }
}
