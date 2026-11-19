import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { PostsService } from './posts.service';

/**
 * Registered FIRST in BlogModule, so GET /posts/mine is matched here
 * before the public GET /posts/:id route reads 'mine' as an id.
 */
@ApiTags('Blog')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Auth()
  @Post()
  @ApiOperation({ summary: 'Create a post as DRAFT or PUBLISHED, with up to 5 tags (BLG-01, BLG-08)' })
  create(@CurrentUser() user: UserDocument, @Body() dto: CreatePostDto) {
    return this.posts.create(user, dto);
  }

  @Auth()
  @Get('mine')
  @ApiOperation({ summary: 'My posts including drafts, with like and comment counts (BLG-03)' })
  @ApiQuery({ name: 'page', required: false })
  mine(@CurrentUser() user: UserDocument, @Query('page') page = '1') {
    return this.posts.mine(user, Number(page) || 1);
  }

  @Auth()
  @Get('mine/:id')
  @ApiOperation({ summary: 'One of my posts, including drafts and hidden ones (BLG-03)' })
  mineOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.posts.mineOne(user, id);
  }

  @Auth()
  @Patch(':id')
  @ApiOperation({ summary: 'Edit my post, its tags or status (BLG-04, BLG-08)' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(user, id, dto);
  }

  @Auth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete my post and its comments (BLG-04)' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.posts.remove(user, id);
  }
}
