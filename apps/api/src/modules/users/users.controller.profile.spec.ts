jest.mock('./users.service', () => ({
  UsersService: class {
    async findById(_id: string): Promise<unknown> { throw new NotFoundException('User not found'); }
  },
}));
// Neither database initialization nor native password hashing belongs in this unit boundary.
jest.mock('@studyai/database', () => { throw new Error('Database import forbidden in profile contract unit'); });
jest.mock('bcrypt', () => ({}));

import 'reflect-metadata';
import { Logger, NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Locale, SubscriptionTier, UserRole } from '@studyai/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

interface SubjectParameter {
  index: number;
  data?: unknown;
  factory: (data: unknown, context: ExecutionContext) => unknown;
}

describe('UsersController — guarded canonical profile contract', () => {
  const record: Awaited<ReturnType<UsersService['findById']>> = {
    id: 'canonical-profile-subject',
    email: 'profile@example.test',
    firstName: 'Canonical',
    lastName: 'User',
    avatarUrl: null,
    role: UserRole.ADMIN,
    locale: Locale.EN,
    subscriptionTier: SubscriptionTier.FREE,
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    isActive: true,
    passwordHash: 'unit-only-private-field',
    refreshTokenHash: 'unit-only-private-field',
    verificationToken: 'unit-only-private-field',
    resetToken: 'unit-only-private-field',
    authProvider: 'email',
    providerId: null,
    resetTokenExpires: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function subjects() {
    const config = new ConfigService({ auth: { jwtSecret: 'x'.repeat(40) } });
    const users = new UsersService(config);
    const findById = jest.spyOn(users, 'findById');
    const strategy = new JwtStrategy(config, users);
    const controller = new UsersController(users);
    return { findById, strategy, controller };
  }

  afterEach(() => { jest.restoreAllMocks(); });

  it('verified sub selects the same canonical user.id through the existing guarded profile route', async () => {
    const { findById, strategy, controller } = subjects();
    findById.mockResolvedValue(record);
    const principal = await strategy.validate({
      sub: record.id,
      email: 'stale-claim@example.test',
      role: UserRole.STUDENT,
    });
    expect(principal).toEqual({
      sub: record.id,
      email: record.email,
      role: record.role,
      locale: record.locale,
    });
    expect(Reflect.getMetadata(PATH_METADATA, UsersController)).toBe('users');
    expect(Reflect.getMetadata(PATH_METADATA, controller.getProfile)).toBe('profile');
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toContain(JwtAuthGuard);
    const parameters: Record<string, SubjectParameter> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'getProfile');
    const subject = Object.values(parameters).find(parameter => parameter.index === 0);
    if (!subject) throw new Error('Profile subject parameter missing');
    expect(subject.data).toBe('sub');
    const context = new ExecutionContextHost(
      [{ user: principal }], UsersController, controller.getProfile,
    );
    const selectedId = subject.factory(subject.data, context);
    expect(selectedId).toBe(record.id);
    if (typeof selectedId !== 'string') throw new Error('Profile subject is not a canonical id');
    const profile = await controller.getProfile(selectedId);
    expect(findById).toHaveBeenNthCalledWith(1, record.id);
    expect(findById).toHaveBeenNthCalledWith(2, record.id);
    expect(findById).toHaveBeenCalledTimes(2);
    expect(profile).toEqual({
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      avatarUrl: record.avatarUrl,
      role: record.role,
      locale: record.locale,
      subscriptionTier: record.subscriptionTier,
      emailVerified: record.emailVerified,
      createdAt: record.createdAt,
    });
    expect(Object.keys(profile).sort()).toEqual([
      'avatarUrl', 'createdAt', 'email', 'emailVerified', 'firstName',
      'id', 'lastName', 'locale', 'role', 'subscriptionTier',
    ].sort());
    for (const key of ['sub', 'passwordHash', 'refreshTokenHash', 'verificationToken', 'resetToken']) {
      expect(profile).not.toHaveProperty(key);
    }
  });

  it('profile lookup failure propagates without fabricating a user', async () => {
    const { findById, controller } = subjects();
    const error = new NotFoundException('User not found');
    findById.mockRejectedValue(error);
    await expect(controller.getProfile(record.id)).rejects.toBe(error);
    expect(findById).toHaveBeenCalledTimes(1);
    expect(findById).toHaveBeenCalledWith(record.id);
  });

  it.each([null, { ...record, isActive: false }])('rejects missing or inactive principals before profile use', async (user) => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { findById, strategy } = subjects();
    if (user === null) {
      findById.mockRejectedValue(new NotFoundException('User not found'));
    } else {
      findById.mockResolvedValue(user);
    }
    await expect(strategy.validate({
      sub: record.id, email: record.email, role: UserRole.ADMIN,
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('JWT lookup error is denied and is not a profile fallback', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { findById, strategy } = subjects();
    findById.mockRejectedValue(new NotFoundException('User not found'));
    await expect(strategy.validate({
      sub: record.id, email: record.email, role: UserRole.ADMIN,
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
