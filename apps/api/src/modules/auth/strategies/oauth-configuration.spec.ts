import { ConfigService } from '@nestjs/config';
import { AppleStrategy } from './apple.strategy';
import { GoogleStrategy } from './google.strategy';

function disabledConfig(): ConfigService {
  return { get: jest.fn(() => undefined) } as unknown as ConfigService;
}

describe('optional OAuth strategy configuration', () => {
  it('rejects Google OAuth initiation safely when credentials are absent', () => {
    const strategy = new GoogleStrategy(disabledConfig());
    const fail = jest.fn();
    (strategy as any).fail = fail;

    strategy.authenticate({});

    expect(fail).toHaveBeenCalledWith({ message: 'Google OAuth is not configured.' }, 503);
  });

  it('rejects Apple OAuth initiation safely when credentials are absent', () => {
    const strategy = new AppleStrategy(disabledConfig());
    const fail = jest.fn();
    (strategy as any).fail = fail;

    strategy.authenticate({});

    expect(fail).toHaveBeenCalledWith({ message: 'Apple OAuth is not configured.' }, 503);
  });
});
