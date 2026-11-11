import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { HotelsService } from './hotels.service';
import { findRoomConflicts, roomEverReserved } from './room-conflicts';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private model: Model<RoomDocument>,
    @InjectConnection() private connection: Connection,
    private readonly hotels: HotelsService,
  ) {}

  async create(user: UserDocument, hotelId: string, dto: CreateRoomDto) {
    this.hotels.assertManages(user, hotelId);
    await this.hotels.findOne(hotelId); // 404 if the hotel does not exist
    try {
      return await this.model.create({ ...dto, hotel: hotelId as unknown as Room['hotel'] });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Room number already exists in this hotel');
      throw e;
    }
  }

  /** Loads a room and checks it belongs to the hotel in the URL and the moderator manages that hotel. */
  async getManaged(user: UserDocument, hotelId: string, roomId: string) {
    this.hotels.assertManages(user, hotelId);
    const room = await this.model.findById(roomId);
    if (!room || room.hotel.toString() !== hotelId) throw new NotFoundException('Room not found in this hotel');
    return room;
  }

  async update(user: UserDocument, hotelId: string, roomId: string, dto: UpdateRoomDto) {
    const room = await this.getManaged(user, hotelId, roomId);
    // The DTO instance carries every declared field (undefined when not sent), so copy only the ones that were sent.
    const changes = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    Object.assign(room, changes); // price change never touches existing reservations: they store their own price
    return room.save();
  }

  async deactivate(user: UserDocument, hotelId: string, roomId: string) {
    const room = await this.getManaged(user, hotelId, roomId);
    const far = new Date('2100-01-01'); // any reservation from now on
    const conflicts = await findRoomConflicts(this.connection, room._id, new Date(), far);
    if (conflicts.length) throw new ConflictException('Room has Confirmed or Pending Payment reservations');
    room.isActive = false;
    return room.save();
  }

  async remove(user: UserDocument, hotelId: string, roomId: string) {
    const room = await this.getManaged(user, hotelId, roomId);
    if (await roomEverReserved(this.connection, room._id)) {
      throw new ConflictException('A room that was ever reserved cannot be deleted. Deactivate it.');
    }
    await room.deleteOne();
    return { deleted: true };
  }
}
