import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../enums/role.enum';

// Anything that can hold a user id: a string, an ObjectId, or a populated document
export type IdLike = string | Types.ObjectId | { _id: string | Types.ObjectId } | null | undefined;

// The logged-in user (the UserDocument from @CurrentUser() fits this shape)
export interface CurrentUserLike {
  id: string;
  role: Role | string;
}

export interface OwnershipOptions {
  allowAdmin?: boolean; // true: admins can access any record (e.g. viewing any booking)
  notFoundMessage?: string; // e.g. 'Booking not found'
}

// Turns any IdLike into a plain string id, so ObjectIds and strings can be compared safely
export function toIdString(value: IdLike): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (typeof value === 'object' && '_id' in value && value._id) return String(value._id);
  return undefined;
}

// true only if both ids exist and are equal. Never compare ObjectIds with ===.
export function sameId(a: IdLike, b: IdLike): boolean {
  const x = toIdString(a);
  const y = toIdString(b);
  return !!x && x === y;
}

/**
 * ACC-11: users can only access their own records.
 * Throws 404 (not 403) when the record is missing OR belongs to someone else,
 * so nobody can find out which ids exist.
 *
 * Usage:
 *   const booking = assertOwnership(
 *     await this.bookingModel.findById(id),
 *     (b) => b.userId,
 *     user,
 *     { notFoundMessage: 'Booking not found', allowAdmin: true },
 *   );
 */
export function assertOwnership<T>(
  doc: T | null | undefined,
  ownerOf: (doc: T) => IdLike,
  user: CurrentUserLike,
  options: OwnershipOptions = {},
): T {
  const notFound = new NotFoundException(options.notFoundMessage ?? 'Not found');
  if (!doc) throw notFound;
  if (options.allowAdmin && user.role === Role.ADMIN) return doc;
  if (!sameId(ownerOf(doc), user.id)) throw notFound;
  return doc;
}