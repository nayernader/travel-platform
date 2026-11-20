import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Connection, Model, Types } from 'mongoose';
import { UserStatus } from '../common/enums/user-status.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';

@ApiTags('Blog')
@Controller('authors')
export class AuthorsController {
  constructor(
    @InjectModel(Post.name) private posts: Model<PostDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Public author page: name, join date, published posts and public itineraries, 10 per page each (BLG-12)',
  })
  @ApiQuery({ name: 'postsPage', required: false })
  @ApiQuery({ name: 'itinerariesPage', required: false })
  async author(
    @Param('id') id: string,
    @Query('postsPage') postsPage = '1',
    @Query('itinerariesPage') itinerariesPage = '1',
  ) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Author not found');
    const user: any = await this.connection.model('User').findById(id).select('name createdAt status');
    if (!user || user.status === UserStatus.DEACTIVATED) throw new NotFoundException('Author not found');

    const pPage = Number(postsPage) || 1;
    const iPage = Number(itinerariesPage) || 1;
    const postFilter = { author: user._id, status: PostStatus.PUBLISHED, hidden: false };
    const itFilter = { user: user._id, visibility: 'PUBLIC', hidden: false };
    // The Itinerary model (team contract) is read by name; empty if it is not registered
    const hasItineraries = this.connection.modelNames().includes('Itinerary');
    const itineraries = hasItineraries ? this.connection.model('Itinerary') : undefined;

    const [postRows, postTotal, itRows, itTotal] = await Promise.all([
      this.posts
        .find(postFilter)
        .sort({ createdAt: -1 })
        .skip(getSkip(pPage))
        .limit(PAGE_SIZE)
        .select('title tags createdAt likes commentCount'),
      this.posts.countDocuments(postFilter),
      itineraries
        ? itineraries
            .find(itFilter)
            .sort({ updatedAt: -1 })
            .skip(getSkip(iPage))
            .limit(PAGE_SIZE)
            .select('title countries startDate')
        : [],
      itineraries ? itineraries.countDocuments(itFilter) : 0,
    ]);

    const posts = postRows.map((p: any) => ({
      _id: p.id,
      title: p.title,
      tags: p.tags,
      createdAt: p.createdAt,
      likeCount: p.likes.length,
      commentCount: p.commentCount,
    }));
    return {
      id,
      name: user.name,
      joinedAt: user.createdAt,
      posts: buildPage(posts, postTotal, pPage),
      itineraries: buildPage(itRows as any[], itTotal, iPage),
    };
  }
}
