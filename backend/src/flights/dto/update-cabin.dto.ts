import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCabinDto } from './cabin.dto';

/** FLT-05: price, seat count and baggage rules. The cabin class cannot be changed. */
export class UpdateCabinDto extends PartialType(OmitType(CreateCabinDto, ['cabinClass'] as const)) {}