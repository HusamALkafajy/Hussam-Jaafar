import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LearnerProfile } from '@studyai/domain';
import { LearnerProfileRepository } from './learner-profile.repository';

@Injectable()
export class LearnerProfileService {
  private readonly logger = new Logger(LearnerProfileService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly repository: LearnerProfileRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getProfile(userId: string): Promise<LearnerProfile> {
    const cacheKey = `learner_profile:${userId}`;
    const cachedProfile = await this.cacheManager.get<LearnerProfile>(cacheKey);

    if (cachedProfile) {
      this.logger.debug(`Cache hit for learner profile: ${userId}`);
      return cachedProfile;
    }

    this.logger.debug(`Cache miss for learner profile: ${userId}. Reconstructing from read model...`);
    const profile = await this.repository.buildProfileForUser(userId);

    // Store in cache
    await this.cacheManager.set(cacheKey, profile, this.CACHE_TTL);
    
    return profile;
  }

  async invalidateProfile(userId: string, reason: string): Promise<void> {
    this.logger.log(`Invalidating LearnerProfile for user ${userId}. Reason: ${reason}`);
    await this.cacheManager.del(`learner_profile:${userId}`);
  }
}
