import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto, ResolveReportDto } from './dto/reports.dto';
import { ModerationService } from './moderation.service';

enum ContentType {
  post = 'post',
  comment = 'comment',
  review = 'review',
  itinerary = 'itinerary',
}

@ApiTags('Reports and moderation')
@Controller()
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Auth(Role.USER)
  @Post('reports')
  @ApiOperation({ summary: 'Report a post, comment, review or itinerary with a reason, once per item (GEN-09)' })
  report(@CurrentUser() u: UserDocument, @Body() dto: CreateReportDto) {
    return this.moderation.report(u, dto);
  }

  @Auth(Role.ADMIN)
  @Get('admin/reports')
  @ApiOperation({ summary: 'Open reports, oldest first (GEN-09, GEN-10)' })
  @ApiQuery({ name: 'page', required: false })
  open(@Query('page') page = '1') {
    return this.moderation.listOpen(Number(page) || 1);
  }

  @Auth(Role.ADMIN)
  @Patch('admin/reports/:id')
  @ApiOperation({ summary: 'Resolve a report: dismiss it, hide the content or delete the content (GEN-10)' })
  resolve(@CurrentUser() admin: UserDocument, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.moderation.resolve(admin, id, dto);
  }

  @Auth(Role.ADMIN)
  @Get('admin/content/:type/:id')
  @ApiParam({ name: 'type', enum: ContentType })
  @ApiOperation({ summary: 'View any post, comment, review or itinerary, including hidden ones, with its open reports (GEN-10)' })
  view(@Param('type', new ParseEnumPipe(ContentType)) type: ContentType, @Param('id') id: string) {
    return this.moderation.getContent(type, id);
  }

  @Auth(Role.ADMIN)
  @Patch('admin/content/:type/:id/hide')
  @ApiParam({ name: 'type', enum: ContentType })
  @ApiOperation({ summary: 'Hide any post, comment, review or itinerary directly (GEN-10)' })
  hide(
    @CurrentUser() admin: UserDocument,
    @Param('type', new ParseEnumPipe(ContentType)) type: ContentType,
    @Param('id') id: string,
  ) {
    return this.moderation.applyToContent(admin, type, id, 'hide');
  }

  @Auth(Role.ADMIN)
  @Delete('admin/content/:type/:id')
  @ApiParam({ name: 'type', enum: ContentType })
  @ApiOperation({ summary: 'Delete any post, comment, review or itinerary directly (GEN-10)' })
  remove(
    @CurrentUser() admin: UserDocument,
    @Param('type', new ParseEnumPipe(ContentType)) type: ContentType,
    @Param('id') id: string,
  ) {
    return this.moderation.applyToContent(admin, type, id, 'delete');
  }
}
