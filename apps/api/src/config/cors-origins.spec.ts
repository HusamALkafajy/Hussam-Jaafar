import { resolveCorsOrigins } from './cors-origins';

describe('resolveCorsOrigins', () => {
  it('permits only the browser-visible frontend origin in production', () => {
    expect(resolveCorsOrigins('https://alpha.example.test', 'production')).toEqual([
      'https://alpha.example.test',
    ]);
  });

  it('retains the accepted loopback origins outside production without duplicates', () => {
    expect(resolveCorsOrigins('http://localhost:3000', 'development')).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });
});
