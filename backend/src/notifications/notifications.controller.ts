import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@Auth()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My notifications, newest first', description: 'GEN-01' })
  list(@CurrentUser() user: UserDocument, @Query() query: PaginationQueryDto) {
    return this.notifications.list(user.id, query.page);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread notifications', description: 'GEN-01' })
  unreadCount(@CurrentUser() user: UserDocument) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read', description: 'GEN-01' })
  markAllRead(@CurrentUser() user: UserDocument) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read', description: 'GEN-01' })
  markRead(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }
}