import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { assertJwtSecrets } from './jwt-secrets';

describe('JWT signing-secret policy', () => {
  const access = randomBytes(48).toString('hex');
  const refresh = randomBytes(48).toString('hex');

  it('accepts independent CSPRNG production keys', () => {
    expect(access === refresh).toBe(false);
    expect(() => assertJwtSecrets(access, refresh, true)).not.toThrow();
  });

  it.each([undefined, null, '', '   '])('rejects absent access material (%#)', (value) => {
    expect(() => assertJwtSecrets(value, refresh, true)).toThrow();
  });
  it.each([undefined, null, '', '   '])('rejects absent refresh material (%#)', (value) => {
    expect(() => assertJwtSecrets(access, value, true)).toThrow();
  });
  it('rejects a shared key even outside production', () => {
    expect(() => assertJwtSecrets(access, access, false)).toThrow();
  });
  it.each(['<SET_JWT_SECRET>', 'your-signing-placeholder-change-me', 'a'.repeat(64), 'short'])(
    'rejects weak/placeholder production material (%#)', (value) => {
      expect(() => assertJwtSecrets(value, refresh, true)).toThrow();
    },
  );
  it('never includes supplied material in diagnostics', () => {
    const marker = randomBytes(16).toString('hex');
    try {
      assertJwtSecrets(marker, marker, true);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(String(error).includes(marker)).toBe(false);
    }
  });

  it('uses incompatible access/refresh verification paths', async () => {
    const jwt = new JwtService();
    const accessToken = await jwt.signAsync({ sub: 'test-subject' }, { secret: access, expiresIn: '1m' });
    const refreshToken = await jwt.signAsync({ sub: 'test-subject' }, { secret: refresh, expiresIn: '1m' });
    expect((await jwt.verifyAsync(accessToken, { secret: access })).sub).toBe('test-subject');
    expect((await jwt.verifyAsync(refreshToken, { secret: refresh })).sub).toBe('test-subject');
    await expect(jwt.verifyAsync(accessToken, { secret: refresh })).rejects.toThrow();
    await expect(jwt.verifyAsync(refreshToken, { secret: access })).rejects.toThrow();
  });
});
