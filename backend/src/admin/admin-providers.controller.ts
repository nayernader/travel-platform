import { Body, Controller, Param, ParseEnumPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminProvidersService } from './admin-providers.service';
import { CreateModeratorDto } from './dto/moderators.dto';

enum ProviderType {
  airline = 'airline',
  hotel = 'hotel',
}

@ApiTags('Admin')
@Auth(Role.ADMIN)
@Controller('admin')
export class AdminProvidersController {
  constructor(private readonly providers: AdminProvidersService) {}

  @Post('moderators')
  @ApiOperation({ summary: 'Create an airline or hotel moderator linked to one provider, with a temporary password (ACC-13)' })
  create(@CurrentUser() admin: UserDocument, @Body() dto: CreateModeratorDto) {
    return this.providers.createModerator(admin, dto);
  }

  @Patch('providers/:type/:id/deactivate')
  @ApiParam({ name: 'type', enum: ProviderType })
  @ApiOperation({ summary: 'Deactivate an airline or hotel: hidden from search, cannot be booked (ACC-15)' })
  deactivate(
    @CurrentUser() a: UserDocument,
    @Param('type', new ParseEnumPipe(ProviderType)) t: ProviderType,
    @Param('id') id: string,
  ) {
    return this.providers.setProviderActive(a, t, id, false);
  }

  @Patch('providers/:type/:id/reactivate')
  @ApiParam({ name: 'type', enum: ProviderType })
  @ApiOperation({ summary: 'Reactivate an airline or hotel (ACC-15)' })
  reactivate(
    @CurrentUser() a: UserDocument,
    @Param('type', new ParseEnumPipe(ProviderType)) t: ProviderType,
    @Param('id') id: string,
  ) {
    return this.providers.setProviderActive(a, t, id, true);
  }
}
