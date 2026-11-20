import {
  BadRequestException,
  Controller,
  Delete,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { unlinkSync } from 'fs';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { imageUploadOptions } from '../uploads/image-upload.options';
import { MAX_IMAGES_PER_ITEM } from '../uploads/uploads.constants';
import { UploadsService } from '../uploads/uploads.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { PostsService } from './posts.service';

const removeFiles = (files: Express.Multer.File[] = []) =>
  files.forEach((f) => {
    try {
      unlinkSync(f.path);
    } catch {
      /* already gone */
    }
  });

@ApiTags('Blog')
@Controller('posts/:id/images')
export class PostImagesController {
  constructor(
    private readonly posts: PostsService,
    private readonly uploads: UploadsService,
  ) {}

  @Auth()
  @Post()
  @ApiOperation({ summary: 'Attach up to 5 JPG/PNG images, 5 MB each, to my post (BLG-10, GEN-08)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MAX_IMAGES_PER_ITEM, imageUploadOptions))
  async add(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let post;
    try {
      post = await this.posts.getOwned(user, id);
    } catch (e) {
      removeFiles(files); // nothing is kept for a post that is not yours
      throw e;
    }
    if (post.images.length + (files?.length ?? 0) > MAX_IMAGES_PER_ITEM) {
      removeFiles(files);
      throw new BadRequestException(`At most ${MAX_IMAGES_PER_ITEM} images per post`);
    }
    post.images.push(...this.uploads.processImages(files ?? []));
    return post.save();
  }

  @Auth()
  @Delete()
  @ApiOperation({ summary: 'Remove one image from my post by its URL (BLG-10)' })
  @ApiQuery({ name: 'url', example: '/uploads/3f2a....png' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string, @Query('url') url: string) {
    return this.removeImage(user, id, (u) => u === url);
  }

  @Auth()
  @Delete(':imageId')
  @ApiOperation({ summary: 'Remove one image from my post by its file name, e.g. 3f2a....png (BLG-10)' })
  removeById(@CurrentUser() user: UserDocument, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.removeImage(user, id, (u) => u === `/uploads/${imageId}`);
  }

  private async removeImage(user: UserDocument, id: string, match: (u: string) => boolean) {
    const post = await this.posts.getOwned(user, id);
    const before = post.images.length;
    post.images = post.images.filter((u) => !match(u));
    if (post.images.length === before) throw new NotFoundException('Image not found on this post');
    return post.save();
  }
}
