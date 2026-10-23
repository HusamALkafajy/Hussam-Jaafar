import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';

jest.mock('@studyai/database', () => ({
  db: { update: jest.fn() }, users: { id: 'id', refreshTokenHash: 'refreshTokenHash' },
  eq: (field: string, value: string) => ({ field, value }),
  and: (...predicates: unknown[]) => predicates,
}));
const { db, users } = require('@studyai/database');

describe('UsersService atomic refresh hash predicate', () => {
  const service = new UsersService({} as ConfigService);
  let row: { id: string; refreshTokenHash: string | null };
  let predicate: { field: keyof typeof row; value: string }[];
  let returning: jest.Mock;
  beforeEach(() => {
    row = { id: 'user-1', refreshTokenHash: 'expected-hash' };
    returning = jest.fn();
    db.update.mockImplementation((table: unknown) => {
      expect(table).toBe(users);
      return { set: (values: Partial<typeof row>) => ({ where: (where: typeof predicate) => {
        predicate = where;
        returning.mockImplementation(async (projection: unknown) => {
          expect(projection).toEqual({ id: users.id });
          if (!predicate.every(p => row[p.field] === p.value)) return [];
          row = { ...row, ...values };
          return [{ id: row.id }];
        });
        return { returning };
      } }) };
    });
  });
  it('updates exactly one matching user and stored hash through one conditional statement', async () => {
    expect(await service.rotateRefreshTokenHash('user-1', 'expected-hash', 'replacement-hash')).toBe(true);
    expect(predicate).toEqual([{ field: 'id', value: 'user-1' }, { field: 'refreshTokenHash', value: 'expected-hash' }]);
    expect(row.refreshTokenHash).toBe('replacement-hash');
  });
  it('rejects a stale expected hash without replacing current state', async () => {
    expect(await service.rotateRefreshTokenHash('user-1', 'stale-hash', 'replacement-hash')).toBe(false);
    expect(row.refreshTokenHash).toBe('expected-hash');
  });
  it('rejects another user without changing the row', async () => {
    expect(await service.rotateRefreshTokenHash('other-user', 'expected-hash', 'replacement-hash')).toBe(false);
    expect(row.refreshTokenHash).toBe('expected-hash');
  });
  it('rejects null/revoked state', async () => {
    row.refreshTokenHash = null;
    expect(await service.rotateRefreshTokenHash('user-1', 'expected-hash', 'replacement-hash')).toBe(false);
    expect(row.refreshTokenHash).toBeNull();
  });
});
