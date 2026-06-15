import { Test, TestingModule } from '@nestjs/testing';
import { CertificationsService } from './certifications.service';

jest.mock('@studyai/database', () => {
  const mockSelectChain: any = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockInsertChain: any = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockDb = {
    select: jest.fn(() => mockSelectChain),
    insert: jest.fn(() => mockInsertChain),
  };

  return {
    db: mockDb,
    mockDb,
    mockSelectChain,
    mockInsertChain,
    certifications: { id: 'certifications.id', certificateHash: 'certifications.certificateHash' },
    users: { id: 'users.id', firstName: 'users.firstName', lastName: 'users.lastName', email: 'users.email' },
    learningPaths: { id: 'learningPaths.id', skillName: 'learningPaths.skillName', difficultyLevel: 'learningPaths.difficultyLevel' },
    eq: jest.fn((a, b) => ({ type: 'eq', a, b })),
    and: jest.fn((...args) => ({ type: 'and', args })),
  };
});

const { mockDb, mockSelectChain, mockInsertChain } = require('@studyai/database');

describe('CertificationsService', () => {
  let service: CertificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CertificationsService],
    }).compile();

    service = module.get<CertificationsService>(CertificationsService);
    jest.clearAllMocks();
  });

  describe('issueCertificate', () => {
    it('should generate a cryptographic SHA-256 hash and save the certificate', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => callback([])); // Not existing

      const mockRecord = { id: 'cert-1', certificateHash: 'abc-hash-123' };
      mockInsertChain.returning.mockResolvedValue([mockRecord]);

      const result = await service.issueCertificate('user-1', 'path-1');

      expect(result).toEqual(mockRecord);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should return existing certificate if already exists', async () => {
      const mockRecord = { id: 'cert-1', certificateHash: 'abc-hash-123' };
      mockSelectChain.then.mockImplementation((callback: any) => callback([mockRecord]));

      const result = await service.issueCertificate('user-1', 'path-1');

      expect(result).toEqual(mockRecord);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('verifyCertificate', () => {
    it('should query details and return verification info if valid hash', async () => {
      const mockRow = {
        id: 'cert-1',
        certificateHash: 'hash-val',
        issuedAt: new Date(),
        verificationUrl: '/url',
        user: { firstName: 'Husam', lastName: 'J', email: 'husamjfr@gmail.com' },
        path: { skillName: 'Kubernetes', difficultyLevel: 'advanced' },
      };

      mockSelectChain.then.mockImplementation((callback: any) => callback([mockRow]));

      const result = await service.verifyCertificate('hash-val');

      expect(result.isValid).toBe(true);
      expect(result.recipientName).toBe('Husam J');
      expect(result.skillName).toBe('Kubernetes');
    });

    it('should throw NotFoundException if hash not found', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => callback([]));

      await expect(service.verifyCertificate('invalid-hash')).rejects.toThrow();
    });
  });
});
