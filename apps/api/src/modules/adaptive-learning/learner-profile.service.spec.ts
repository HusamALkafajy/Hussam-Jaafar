import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LearnerProfileService } from './learner-profile.service';
import { LearnerProfileRepository } from './learner-profile.repository';
import { LearnerProfile } from '@studyai/domain';

describe('LearnerProfileService', () => {
  let service: LearnerProfileService;
  let cacheManager: any;
  let repository: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    repository = {
      buildProfileForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearnerProfileService,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: LearnerProfileRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<LearnerProfileService>(LearnerProfileService);
  });

  describe('Caching Behavior', () => {
    it('should return cached profile on cache hit', async () => {
      const mockProfile: Partial<LearnerProfile> = { userId: 'u1' };
      cacheManager.get.mockResolvedValue(mockProfile);

      const result = await service.getProfile('u1');

      expect(result).toBe(mockProfile);
      expect(repository.buildProfileForUser).not.toHaveBeenCalled();
    });

    it('should reconstruct profile on cache miss and store it in cache', async () => {
      const mockProfile: Partial<LearnerProfile> = { userId: 'u1' };
      cacheManager.get.mockResolvedValue(null);
      repository.buildProfileForUser.mockResolvedValue(mockProfile);

      const result = await service.getProfile('u1');

      expect(result).toBe(mockProfile);
      expect(repository.buildProfileForUser).toHaveBeenCalledWith('u1');
      expect(cacheManager.set).toHaveBeenCalledWith('learner_profile:u1', mockProfile, 3600);
    });

    it('should invalidate cache when explicitly triggered', async () => {
      await service.invalidateProfile('u1', 'Quiz Completed');

      expect(cacheManager.del).toHaveBeenCalledWith('learner_profile:u1');
    });
  });
});
