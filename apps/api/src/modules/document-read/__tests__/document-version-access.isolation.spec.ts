import { Test, TestingModule } from '@nestjs/testing';
import { DocumentReadService } from '../document-read.service';
import { db, files, documentVersions, users } from '@studyai/database';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

jest.mock('@studyai/database', () => {
  const original = jest.requireActual('@studyai/database');
  return {
    ...original,
    db: {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    },
  };
});

describe('DocumentVersionAccess Isolation (Adversarial)', () => {
  let service: DocumentReadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentReadService],
    }).compile();

    service = module.get<DocumentReadService>(DocumentReadService);
    jest.clearAllMocks();
  });

  const userA = randomUUID();
  const userB = randomUUID();
  const fileA = randomUUID();
  const fileB = randomUUID();
  const v1 = randomUUID();
  const v2 = randomUUID();
  const b1 = randomUUID();

  it('1. User A + File A resolves V2 deterministically by versionNumber', async () => {
    let callCount = 0;
    ((db as any).limit as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ userId: userA, status: 'completed' }]); // File check
      if (callCount === 2) return Promise.resolve([{ id: v2 }]); // Version check
      return Promise.resolve([]);
    });

    const res = await service.resolveActiveReadableVersion(fileA, userA);
    expect(res.versionId).toBe(v2);
    
    // Check orderBy call
    expect((db as any).orderBy).toHaveBeenCalled();
  });

  it('3. User A cannot resolve File B (Foreign file access follows 404 anti-enumeration)', async () => {
    ((db as any).limit as jest.Mock).mockImplementation(() => {
      // Returns User B's ownership
      return Promise.resolve([{ userId: userB, status: 'completed' }]); 
    });

    await expect(service.resolveActiveReadableVersion(fileB, userA)).rejects.toThrow(NotFoundException);
  });

  it('6. File with no published version is handled explicitly', async () => {
    let callCount = 0;
    ((db as any).limit as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ userId: userA, status: 'completed' }]); // File check
      if (callCount === 2) return Promise.resolve([]); // No versions
      return Promise.resolve([]);
    });

    const res = await service.resolveActiveReadableVersion(fileA, userA);
    expect(res.versionId).toBeNull();
  });

  it('10. Explicit historical version validation preserves V1 after V2 exists', async () => {
    let callCount = 0;
    ((db as any).limit as jest.Mock).mockImplementation(() => {
      callCount++;
      // validateReadableVersion checks version first, then file
      if (callCount === 1) return Promise.resolve([{ fileId: fileA, versionId: v1 }]); 
      if (callCount === 2) return Promise.resolve([{ userId: userA, status: 'completed' }]);
      return Promise.resolve([]);
    });

    const res = await service.validateReadableVersion(v1, userA);
    expect(res.versionId).toBe(v1);
    expect(res.fileId).toBe(fileA);
  });
});
