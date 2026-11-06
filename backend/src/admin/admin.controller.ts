import { Controller, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Patch('users/:id/reset-password')
  @Auth(Role.ADMIN)
  @ApiOperation({
    summary: 'Reset a user password to a temporary one',
    description: 'ACC-07a. Returns the temporary password once. The user must change it on next login (ACC-13). Admin accounts cannot be reset here.',
  })
  @ApiParam({ name: 'id', description: 'The user _id from MongoDB' })
  resetPassword(@CurrentUser() admin: UserDocument, @Param('id') id: string) {
    return this.admin.resetPassword(admin, id);
  }
}