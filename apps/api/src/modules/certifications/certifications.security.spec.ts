import { CertificationsService } from './certifications.service';

jest.mock('@studyai/database', () => {
  const chain: Record<string, jest.Mock> = {};
  for (const name of ['select', 'from', 'where', 'insert', 'values', 'innerJoin']) {
    chain[name] = jest.fn(() => chain);
  }
  chain.limit = jest.fn().mockResolvedValue([]);
  chain.returning = jest.fn().mockResolvedValue([{ id: 'inert-record' }]);
  return { db: chain, certifications: {}, users: {}, learningPaths: {},
    eq: jest.fn(), and: jest.fn() };
});

const { db } = require('@studyai/database') as {
  db: Record<string, jest.Mock>;
};

describe('certificate opaque identifiers (database mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.limit.mockResolvedValue([]);
    db.returning.mockResolvedValue([{ id: 'inert-record' }]);
  });
  it('uses independent 256-bit opaque identifiers without a shared signing constant', async () => {
    const service = new CertificationsService();
    await service.issueCertificate('test-user', 'test-path');
    await service.issueCertificate('test-user', 'test-path');
    const first = db.values.mock.calls[0][0].certificateHash as string;
    const second = db.values.mock.calls[1][0].certificateHash as string;
    expect(/^[a-f0-9]{64}$/.test(first)).toBe(true);
    expect(first === second).toBe(false);
    expect(db.values.mock.calls[0][0].verificationUrl).toBe(`/certifications/verify/${first}`);
  });
  it('keeps existing issued certificates unchanged', async () => {
    const existing = { id: 'existing-record' };
    db.limit.mockResolvedValueOnce([existing]);
    expect(await new CertificationsService().issueCertificate('test-user', 'test-path')).toBe(existing);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('preserves lookup verification compatibility for old identifiers', async () => {
    db.limit.mockResolvedValueOnce([{ certificateHash: 'legacy-opaque-id', issuedAt: new Date(0),
      user: { firstName: 'Test', lastName: 'User' },
      path: { skillName: 'Test', difficultyLevel: 'beginner' } }]);
    const result = await new CertificationsService().verifyCertificate('legacy-opaque-id');
    expect(result.isValid).toBe(true);
    expect(result.certificateHash).toBe('legacy-opaque-id');
  });
});
