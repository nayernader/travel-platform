import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminAccountsService } from './admin-accounts.service';
import { ListAccountsDto } from './dto/accounts.dto';

@ApiTags('Admin')
@Auth(Role.ADMIN)
@Controller('admin')
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'All accounts: search by name or email, filter by role and status, 10 per page (ACC-14)' })
  list(@Query() dto: ListAccountsDto) {
    return this.accounts.list(dto);
  }

  @Patch('accounts/:id/suspend')
  @ApiParam({ name: 'id', description: 'The account _id' })
  @ApiOperation({ summary: 'Suspend a user or moderator (ACC-15, ACC-16)' })
  suspend(@CurrentUser() admin: UserDocument, @Param('id') id: string) {
    return this.accounts.setSuspended(admin, id, true);
  }

  @Patch('accounts/:id/reactivate')
  @ApiParam({ name: 'id', description: 'The account _id' })
  @ApiOperation({ summary: 'Reactivate a suspended user or moderator (ACC-15, ACC-16)' })
  reactivate(@CurrentUser() admin: UserDocument, @Param('id') id: string) {
    return this.accounts.setSuspended(admin, id, false);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit log of admin actions, newest first (GEN-07)' })
  @ApiQuery({ name: 'page', required: false })
  audit(@Query('page') page = '1') {
    return this.accounts.auditLogs(Number(page) || 1);
  }
}
