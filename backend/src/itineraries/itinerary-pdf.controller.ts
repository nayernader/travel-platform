import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItineraryPdfService } from './itinerary-pdf.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Itineraries')
@Controller('itineraries')
export class ItineraryPdfController {
  constructor(private readonly pdfs: ItineraryPdfService) {}

  @Auth(Role.USER)
  @Get(':id/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Export an itinerary as a PDF: plan and budget summary (ITN-28, optional)',
    description:
      'The owner can always export. Other logged-in users can export only public, non-hidden itineraries. ' +
      'The budget is shown in the requesting user\'s preferred currency with the rate date.',
  })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Not found, private (not yours), hidden, or its owner deactivated the account' })
  async pdf(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const { fileName, pdf } = await this.pdfs.build(user, id);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}