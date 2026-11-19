import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { BlogPublicController } from './blog-public.controller';
import { BlogPublicService } from './blog-public.service';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { Post, PostSchema } from './schemas/post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    UsersModule, // UsersService for the @Auth() guard
    JwtModule.register({}), // JwtService for the @Auth() guard
  ],
  // PostsController FIRST: its GET posts/mine must be registered before the public GET posts/:id
  controllers: [PostsController, BlogPublicController, InteractionsController],
  providers: [PostsService, BlogPublicService, InteractionsService],
  exports: [PostsService, MongooseModule],
})
export class BlogModule {}
