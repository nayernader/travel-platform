import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { UserDocument } from '../users/schemas/user.schema';
import { CommentDto } from './dto/comment.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectModel(Post.name) private posts: Model<PostDocument>,
    @InjectModel(Comment.name) private comments: Model<CommentDocument>,
  ) {}

  // Only published, non-hidden posts can be commented on or liked
  private async publishedPost(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Post not found');
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED, hidden: false });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  /** BLG-05: comment on a published post (1 to 500 characters). */
  async comment(user: UserDocument, postId: string, dto: CommentDto) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Comment cannot be empty');
    const post = await this.publishedPost(postId);
    const c = await this.comments.create({ post: post._id, author: user._id, text });
    await this.posts.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
    return c;
  }

  private async ownComment(user: UserDocument, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Comment not found');
    const c = await this.comments.findById(id);
    if (!c) throw new NotFoundException('Comment not found');
    if (c.author.toString() !== user.id) throw new ForbiddenException('Not your comment');
    return c;
  }

  /** BLG-07: edit my comment. */
  async editComment(user: UserDocument, id: string, dto: CommentDto) {
    const c = await this.ownComment(user, id);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Comment cannot be empty');
    c.text = text;
    return c.save();
  }

  /** BLG-07: delete my comment, and keep the post's commentCount in sync. */
  async deleteComment(user: UserDocument, id: string) {
    const c = await this.ownComment(user, id);
    await c.deleteOne();
    await this.posts.updateOne({ _id: c.post, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
    return { deleted: true };
  }

  /** BLG-06: $addToSet makes "like once" automatic, even if the button is clicked twice or two tabs race. */
  async like(user: UserDocument, postId: string) {
    const post = await this.publishedPost(postId);
    const updated = await this.posts.findByIdAndUpdate(
      post._id,
      { $addToSet: { likes: user._id } },
      { returnDocument: 'after' },
    );
    return { liked: true, likeCount: updated!.likes.length };
  }

  /** BLG-06: remove my like. */
  async unlike(user: UserDocument, postId: string) {
    if (!Types.ObjectId.isValid(postId)) throw new NotFoundException('Post not found');
    const updated = await this.posts.findByIdAndUpdate(
      postId,
      { $pull: { likes: user._id } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new NotFoundException('Post not found');
    return { liked: false, likeCount: updated.likes.length };
  }
}
