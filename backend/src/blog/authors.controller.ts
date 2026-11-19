import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection, Model, Types } from 'mongoose';
import { UserStatus } from '../common/enums/user-status.enum';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';

@ApiTags('Blog')
@Controller('authors')
export class AuthorsController {
  constructor(
    @InjectModel(Post.name) private posts: Model<PostDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Public author page: name, join date, published posts, public itineraries (BLG-12)' })
  async author(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Author not found');
    const user: any = await this.connection.model('User').findById(id).select('name createdAt status');
    if (!user || user.status === UserStatus.DEACTIVATED) throw new NotFoundException('Author not found');

    // The Itinerary model (team contract) is read by name; empty if it is not registered
    const itineraries = this.connection.modelNames().includes('Itinerary')
      ? this.connection
          .model('Itinerary')
          .find({ user: id, visibility: 'PUBLIC', hidden: false })
          .sort({ updatedAt: -1 })
          .limit(50)
          .select('title countries startDate')
      : Promise.resolve([]);

    const [posts, publicItineraries] = await Promise.all([
      this.posts
        .find({ author: id, status: PostStatus.PUBLISHED, hidden: false })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title tags createdAt'),
      itineraries,
    ]);
    return { id, name: user.name, joinedAt: user.createdAt, posts, itineraries: publicItineraries };
  }
}
