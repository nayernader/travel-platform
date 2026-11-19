import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { CommentDto } from './dto/comment.dto';
import { InteractionsService } from './interactions.service';

@ApiTags('Blog')
@Controller()
export class InteractionsController {
  constructor(private readonly inter: InteractionsService) {}

  @Auth()
  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Comment on a published post, 1 to 500 characters (BLG-05)' })
  comment(@CurrentUser() u: UserDocument, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.inter.comment(u, id, dto);
  }

  @Auth()
  @Patch('comments/:id')
  @ApiOperation({ summary: 'Edit my comment (BLG-07)' })
  edit(@CurrentUser() u: UserDocument, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.inter.editComment(u, id, dto);
  }

  @Auth()
  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete my comment (BLG-07)' })
  remove(@CurrentUser() u: UserDocument, @Param('id') id: string) {
    return this.inter.deleteComment(u, id);
  }

  @Auth()
  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like a post, at most once per user (BLG-06)' })
  like(@CurrentUser() u: UserDocument, @Param('id') id: string) {
    return this.inter.like(u, id);
  }

  @Auth()
  @Delete('posts/:id/like')
  @ApiOperation({ summary: 'Remove my like (BLG-06)' })
  unlike(@CurrentUser() u: UserDocument, @Param('id') id: string) {
    return this.inter.unlike(u, id);
  }
}
