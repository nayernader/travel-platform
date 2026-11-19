import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { excerpt } from './posts.service';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Hidden posts are never public (GEN-10); drafts are never public (BLG-02)
const visible = { status: PostStatus.PUBLISHED, hidden: false };

@Injectable()
export class BlogPublicService {
  constructor(
    @InjectModel(Post.name) private posts: Model<PostDocument>,
    @InjectModel(Comment.name) private comments: Model<CommentDocument>,
  ) {}

  /** BLG-02 browse, newest first, optional tag filter (also used by GET /tags/:tag/posts, BLG-08). */
  async browse(tag?: string, page = 1) {
    const filter: Record<string, unknown> = { ...visible };
    if (tag) filter.tags = tag.trim().toLowerCase();
    const [items, total] = await Promise.all([
      this.posts
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE)
        .populate('author', 'name'),
      this.posts.countDocuments(filter),
    ]);
    return buildPage(items.map((p) => this.card(p)), total, page);
  }

  private card(p: any) {
    return {
      _id: p.id ?? p._id,
      title: p.title,
      author: p.author?.name,
      authorId: p.author?._id,
      createdAt: p.createdAt,
      tags: p.tags,
      excerpt: excerpt(p.body),
      likeCount: p.likes.length,
      commentCount: p.commentCount,
    };
  }

  /** The post page: title, author, date, body, tags, images, like count and comments oldest first (BLG-02, BLG-05). */
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Post not found');
    const p: any = await this.posts.findOne({ _id: id, ...visible }).populate('author', 'name');
    if (!p) throw new NotFoundException('Post not found');
    const comments = await this.comments
      .find({ post: p._id, hidden: false })
      .sort({ createdAt: 1 })
      .populate('author', 'name');
    return {
      ...this.card(p),
      body: p.body,
      images: p.images,
      comments: comments.map((c: any) => ({
        _id: c.id,
        text: c.text,
        author: c.author?.name,
        authorId: c.author?._id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  /** BLG-09: keyword in title, tags or author name. Ordered by likes + comments, newest first as tie-breaker. */
  async search(q: string, page = 1) {
    const rx = new RegExp(escapeRegex((q ?? '').trim()), 'i');
    const pipeline: any[] = [
      { $match: visible },
      { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'authorDoc' } },
      { $unwind: { path: '$authorDoc', preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ title: rx }, { tags: rx }, { 'authorDoc.name': rx }] } },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
          score: { $add: [{ $size: '$likes' }, '$commentCount'] },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
    ];
    const [rows, count] = await Promise.all([
      this.posts.aggregate([...pipeline, { $skip: getSkip(page) }, { $limit: PAGE_SIZE }]),
      this.posts.aggregate([...pipeline, { $count: 'n' }]),
    ]);
    const total = count[0]?.n ?? 0;
    const items = rows.map((r: any) => ({
      _id: r._id,
      title: r.title,
      author: r.authorDoc?.name,
      authorId: r.authorDoc?._id,
      createdAt: r.createdAt,
      tags: r.tags,
      excerpt: excerpt(r.body),
      likeCount: r.likeCount,
      commentCount: r.commentCount,
    }));
    return { ...buildPage(items, total, page), message: total ? undefined : 'No results' };
  }
}
