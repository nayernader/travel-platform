import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RoomsService } from './rooms.service';
import { AddRangeDto, RangeDto, ReplaceAvailabilityDto } from './dto/availability.dto';
import { findRoomConflicts } from './room-conflicts';
import type { UserDocument } from '../users/schemas/user.schema';

const day = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && a.end > b.start;

function toRange(r: RangeDto) {
  const start = day(r.start),
    end = day(r.end);
  if (!(start < end)) throw new BadRequestException('start must be before end');
  return { start, end };
}

function assertNoOverlap(ranges: { start: Date; end: Date }[]) {
  for (let i = 0; i < ranges.length; i++)
    for (let j = i + 1; j < ranges.length; j++)
      if (overlaps(ranges[i], ranges[j])) throw new BadRequestException('Date ranges must not overlap');
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly rooms: RoomsService,
    @InjectConnection() private connection: Connection,
  ) {}

  /** HTL-04 and HTL-06: add a bookable range or a blocked range. */
  async add(user: UserDocument, hotelId: string, roomId: string, dto: AddRangeDto) {
    const room = await this.rooms.getManaged(user, hotelId, roomId);
    const range = toRange(dto);
    if (dto.kind === 'AVAILABLE') {
      const next = [...room.availableRanges.map((r) => ({ start: r.start, end: r.end })), range];
      assertNoOverlap(next);
      room.availableRanges = next as any;
    } else {
      const conflicts = await findRoomConflicts(this.connection, room._id, range.start, range.end);
      if (conflicts.length) throw new ConflictException('Range overlaps a Confirmed or Pending Payment reservation');
      const next = [...room.blockedRanges.map((r) => ({ start: r.start, end: r.end })), range];
      assertNoOverlap(next);
      room.blockedRanges = next as any;
    }
    return room.save();
  }

  /** HTL-05: replace the availability list. Dates with Confirmed reservations cannot be removed. */
  async replace(user: UserDocument, hotelId: string, roomId: string, dto: ReplaceAvailabilityDto) {
    const room = await this.rooms.getManaged(user, hotelId, roomId);
    const next = dto.availableRanges.map(toRange);
    assertNoOverlap(next);
    // every active reservation must stay fully covered by one of the new ranges
    const all = await findRoomConflicts(this.connection, room._id, new Date('1970-01-01'), new Date('2100-01-01'));
    for (const b of all) {
      const ci = b.get('checkIn') as Date,
        co = b.get('checkOut') as Date;
      if (!next.some((r) => r.start <= ci && r.end >= co)) {
        throw new ConflictException('Availability cannot be removed for dates with reservations');
      }
    }
    room.availableRanges = next as any;
    return room.save();
  }
}
