import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { USER_DEACTIVATION_CHECK } from '../common/events/user-deactivation.event';
import { UsersService } from './users.service';

describe('UsersService.deactivateSelf (ACC-12)', () => {
  let passwordHash: string;
  let model: { findById: jest.Mock; findByIdAndUpdate: jest.Mock };
  let events: { emitAsync: jest.Mock };
  let service: UsersService;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Secret123', 4); // low cost: tests only
  });

  const user = (role: Role = Role.USER) => ({ id: 'u1', role, passwordHash, status: UserStatus.ACTIVE });

  beforeEach(() => {
    model = { findById: jest.fn(), findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
    events = { emitAsync: jest.fn().mockResolvedValue([]) }; // no booking listeners yet
    service = new UsersService(model as never, events as never);
  });

  it('deactivates and logs out when nothing blocks it', async () => {
    model.findById.mockResolvedValue(user());
    await expect(service.deactivateSelf('u1', 'Secret123')).resolves.toEqual({ deactivated: true });
    expect(events.emitAsync).toHaveBeenCalledWith(USER_DEACTIVATION_CHECK, { userId: 'u1' });
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { $set: { status: UserStatus.DEACTIVATED }, $unset: { refreshTokenHash: 1 } },
      { returnDocument: 'after' },
    );
  });

  it('rejects a wrong password with 400 and changes nothing', async () => {
    model.findById.mockResolvedValue(user());
    await expect(service.deactivateSelf('u1', 'Wrong999')).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses admins with 403', async () => {
    model.findById.mockResolvedValue(user(Role.ADMIN));
    await expect(service.deactivateSelf('u1', 'Secret123')).rejects.toBeInstanceOf(ForbiddenException);
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 HAS_FUTURE_BOOKINGS when a booking module reports upcoming bookings', async () => {
    model.findById.mockResolvedValue(user());
    events.emitAsync.mockResolvedValue([0, 2]); // flights: 0, hotels: 2
    const error = await service.deactivateSelf('u1', 'Secret123').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'HAS_FUTURE_BOOKINGS' });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
