import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../enums/role.enum';
import { assertOwnership, sameId, toIdString } from './ownership';

describe('ownership helper (ACC-11)', () => {
  const ownerId = new Types.ObjectId();
  const otherId = new Types.ObjectId();
  const owner = { id: ownerId.toHexString(), role: Role.USER };
  const stranger = { id: otherId.toHexString(), role: Role.USER };
  const admin = { id: new Types.ObjectId().toHexString(), role: Role.ADMIN };
  const booking = { _id: new Types.ObjectId(), userId: ownerId };

  describe('toIdString / sameId', () => {
    it('reads strings, ObjectIds and populated documents', () => {
      expect(toIdString(ownerId.toHexString())).toBe(ownerId.toHexString());
      expect(toIdString(ownerId)).toBe(ownerId.toHexString());
      expect(toIdString({ _id: ownerId })).toBe(ownerId.toHexString());
      expect(toIdString(null)).toBeUndefined();
    });

    it('compares an ObjectId with a string correctly', () => {
      expect(sameId(ownerId, ownerId.toHexString())).toBe(true);
      expect(sameId(ownerId, otherId)).toBe(false);
      expect(sameId(undefined, undefined)).toBe(false);
    });
  });

  describe('assertOwnership', () => {
    it('returns the record to its owner', () => {
      expect(assertOwnership(booking, (b) => b.userId, owner)).toBe(booking);
    });

    it('works when the owner field is populated', () => {
      const populated = { ...booking, userId: { _id: ownerId } };
      expect(assertOwnership(populated, (b) => b.userId, owner)).toBe(populated);
    });

    it('throws 404 for another user', () => {
      expect(() => assertOwnership(booking, (b) => b.userId, stranger)).toThrow(NotFoundException);
    });

    it('throws 404 when the record does not exist', () => {
      expect(() => assertOwnership(null, (b: typeof booking) => b.userId, owner)).toThrow(NotFoundException);
    });

    it('blocks admins unless allowAdmin is set', () => {
      expect(() => assertOwnership(booking, (b) => b.userId, admin)).toThrow(NotFoundException);
      expect(assertOwnership(booking, (b) => b.userId, admin, { allowAdmin: true })).toBe(booking);
    });

    it('uses the custom message', () => {
      expect(() =>
        assertOwnership(booking, (b) => b.userId, stranger, { notFoundMessage: 'Booking not found' }),
      ).toThrow('Booking not found');
    });
  });
});