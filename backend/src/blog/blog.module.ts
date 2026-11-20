import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from '../itineraries/schemas/itinerary.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { AuthorsController } from './authors.controller';
import { BlogPublicController } from './blog-public.controller';
import { BlogPublicService } from './blog-public.service';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { PostImagesController } from './post-images.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { Post, PostSchema } from './schemas/post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Itinerary.name, schema: ItinerarySchema }, // BLG-13: attached itinerary
    ]),
    UsersModule, // UsersService for the @Auth() guard
    JwtModule.register({}), // JwtService for the @Auth() guard
    UploadsModule, // UploadsService (GEN-08) for post images
  ],
  // PostsController FIRST: its GET posts/mine must be registered before the public GET posts/:id
  controllers: [
    PostsController,
    BlogPublicController,
    InteractionsController,
    PostImagesController,
    AuthorsController,
  ],
  providers: [PostsService, BlogPublicService, InteractionsService],
  exports: [PostsService, MongooseModule],
})
export class BlogModule {}
