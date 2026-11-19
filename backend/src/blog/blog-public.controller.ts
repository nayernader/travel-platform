import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BlogPublicService } from './blog-public.service';

/**
 * Public routes, no login needed. 'posts/search' is declared before 'posts/:id'
 * so 'search' is never read as an id. PostsController is registered before this
 * controller so 'posts/mine' is never read as an id either.
 */
@ApiTags('Blog')
@Controller()
export class BlogPublicController {
  constructor(private readonly pub: BlogPublicService) {}

  @Get('posts')
  @ApiOperation({
    summary:
      'Published posts: newest first with optional ?tag= (BLG-02); with ?q= keyword search ordered by likes + comments (BLG-09)',
  })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  browse(@Query('tag') tag?: string, @Query('q') q?: string, @Query('page') page = '1') {
    return q !== undefined && q.trim() !== ''
      ? this.pub.search(q, Number(page) || 1)
      : this.pub.browse(tag, Number(page) || 1);
  }

  @Get('posts/search') // extra alias of GET /posts?q=
  @ApiOperation({ summary: 'Same as GET /posts?q= (BLG-09)' })
  @ApiQuery({ name: 'q' })
  @ApiQuery({ name: 'page', required: false })
  search(@Query('q') q: string, @Query('page') page = '1') {
    return this.pub.search(q, Number(page) || 1);
  }

  @Get('tags/:tag/posts')
  @ApiOperation({ summary: 'Published posts with one tag (BLG-08)' })
  @ApiQuery({ name: 'page', required: false })
  byTag(@Param('tag') tag: string, @Query('page') page = '1') {
    return this.pub.browse(tag, Number(page) || 1);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Post page: body, tags, images, like count and the first page of comments (BLG-02, BLG-05)' })
  @ApiQuery({ name: 'commentsPage', required: false, description: 'Page of comments, 10 per page' })
  one(@Param('id') id: string, @Query('commentsPage') commentsPage = '1') {
    return this.pub.findOne(id, Number(commentsPage) || 1);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Comments of a published post, oldest first, 10 per page (BLG-05, GEN-05)' })
  @ApiQuery({ name: 'page', required: false })
  comments(@Param('id') id: string, @Query('page') page = '1') {
    return this.pub.listComments(id, Number(page) || 1);
  }
}
