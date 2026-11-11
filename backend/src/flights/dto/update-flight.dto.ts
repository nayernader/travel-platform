import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFlightDto } from './create-flight.dto';

/** FLT-05: every field is optional. The flight number cannot be changed. */
export class UpdateFlightDto extends PartialType(OmitType(CreateFlightDto, ['flightNumber'] as const)) {}