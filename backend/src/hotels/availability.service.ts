<<<<<<< HEAD
=======

>>>>>>> origin/develop
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import {
  InjectConnection,
  InjectModel,
} from '@nestjs/mongoose';

<<<<<<< HEAD
import { Connection, Model, Types } from 'mongoose';
=======
import { Connection, Model } from 'mongoose';
>>>>>>> origin/develop

import { RoomsService } from './rooms.service';

import {
  AddRangeDto,
  RangeDto,
  ReplaceAvailabilityDto,
} from './dto/availability.dto';

import { findRoomConflicts } from './room-conflicts';

<<<<<<< HEAD
import { Room } from './schemas/room.schema';

import type { UserDocument } from '../users/schemas/user.schema';

const day = (s: string) =>
  new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
=======
import {
  Room,
  RoomDocument,
} from './schemas/room.schema';

import type { UserDocument } from '../users/schemas/user.schema';

const day = (value: string): Date => {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateFormat.test(value)) {
    throw new BadRequestException(
      'Incorrect date format. Use YYYY-MM-DD.',
    );
  }

  const [year, month, date] = value.split('-').map(Number);

  const parsedDate = new Date(
    Date.UTC(year, month - 1, date),
  );

  // Reject impossible dates such as February 30.
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== date
  ) {
    throw new BadRequestException(
      'Incorrect date format. Use YYYY-MM-DD.',
    );
  }

  return parsedDate;
};
>>>>>>> origin/develop

const overlaps = (
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
) => a.start < b.end && a.end > b.start;

function toRange(r: RangeDto) {
  const start = day(r.start);
  const end = day(r.end);

  if (!(start < end)) {
    throw new BadRequestException('start must be before end');
  }

  return { start, end };
}

function assertNoOverlap(
  ranges: { start: Date; end: Date }[],
) {
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (overlaps(ranges[i], ranges[j])) {
        throw new BadRequestException(
          'Date ranges must not overlap',
        );
      }
    }
  }
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly rooms: RoomsService,

    @InjectConnection()
    private connection: Connection,

    @InjectModel(Room.name)
<<<<<<< HEAD
    private roomModel: Model<Room>,
=======
    private roomModel: Model<RoomDocument>,
>>>>>>> origin/develop
  ) {}

  /** HTL-04 and HTL-06: add a bookable range or a blocked range. */
  async add(
    user: UserDocument,
    hotelId: string,
    roomId: string,
    dto: AddRangeDto,
  ) {
    const room = await this.rooms.getManaged(
      user,
      hotelId,
      roomId,
    );

    const range = toRange(dto);

    if (dto.kind === 'AVAILABLE') {
      const next = [
        ...room.availableRanges.map((r) => ({
          start: r.start,
          end: r.end,
        })),
        range,
      ];

      assertNoOverlap(next);
      room.availableRanges = next as any;
    } else {
      const conflicts = await findRoomConflicts(
        this.connection,
        room._id,
        range.start,
        range.end,
      );

      if (conflicts.length) {
        throw new ConflictException(
          'Range overlaps a Confirmed or Pending Payment reservation',
        );
      }

      const next = [
        ...room.blockedRanges.map((r) => ({
          start: r.start,
          end: r.end,
        })),
        range,
      ];

      assertNoOverlap(next);
      room.blockedRanges = next as any;
    }

    return room.save();
  }

  /** HTL-05: replace the availability list. */
  async replace(
    user: UserDocument,
    hotelId: string,
    roomId: string,
    dto: ReplaceAvailabilityDto,
  ) {
    const room = await this.rooms.getManaged(
      user,
      hotelId,
      roomId,
    );

    const next = dto.availableRanges.map(toRange);

    assertNoOverlap(next);

    // Every active reservation must stay fully covered
    // by one of the new availability ranges.
    const all = await findRoomConflicts(
      this.connection,
      room._id,
      new Date('1970-01-01'),
      new Date('2100-01-01'),
    );

    for (const b of all) {
      const ci = b.get('checkIn') as Date;
      const co = b.get('checkOut') as Date;

      if (!next.some((r) => r.start <= ci && r.end >= co)) {
        throw new ConflictException(
          'Availability cannot be removed for dates with reservations',
        );
      }
    }

    room.availableRanges = next as any;

    return room.save();
  }

  /** HTL-08: status of every room of a hotel for [from, to). */
  async roomStatus(
    user: UserDocument,
    hotelId: string,
    from: string,
    to: string,
  ) {
    this.rooms.hotels.assertManages(user, hotelId);

    const start = day(from);
    const end = day(to);

    if (!(start < end)) {
      throw new BadRequestException(
        'from must be before to',
      );
    }

    const rooms = await this.roomModel
<<<<<<< HEAD
      .find({
        hotel: new Types.ObjectId(hotelId),
      })
=======
      .find({ hotel: hotelId })
>>>>>>> origin/develop
      .sort({ roomNumber: 1 });

    const result = [];

    for (const room of rooms) {
      const range = { start, end };

      const blocked = room.blockedRanges.some((b) =>
        overlaps(range, b),
      );

      const bookings = await findRoomConflicts(
        this.connection,
        room._id,
        start,
        end,
      );

      const offered = room.availableRanges.some(
        (a) => a.start <= start && a.end >= end,
      );

      let status = 'AVAILABLE';

<<<<<<< HEAD
=======
      // A reservation takes priority over a blocked range.
>>>>>>> origin/develop
      if (bookings.length) {
        status = 'BOOKED';
      } else if (
        blocked ||
        !offered ||
        !room.isActive
      ) {
        status = 'BLOCKED';
      }

      result.push({
        roomId: room.id,
        roomNumber: room.roomNumber,
        status,
        reservations: bookings.map((b) => ({
          reference: b.get('reference'),
          status: b.get('status'),
        })),
      });
    }

    return result;
  }
<<<<<<< HEAD
}
=======
}
>>>>>>> origin/develop
