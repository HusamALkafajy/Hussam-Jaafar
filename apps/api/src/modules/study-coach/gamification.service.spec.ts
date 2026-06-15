import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';

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

  const mockUpdateChain: any = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    then: jest.fn(),
  };

  const mockDb = {
    select: jest.fn(() => mockSelectChain),
    insert: jest.fn(() => mockInsertChain),
    update: jest.fn(() => mockUpdateChain),
  };

  return {
    db: mockDb,
    mockDb,
    mockSelectChain,
    mockInsertChain,
    mockUpdateChain,
    studentProfiles: { id: 'studentProfiles.id', userId: 'studentProfiles.userId', xp: 'studentProfiles.xp', currentLevel: 'studentProfiles.currentLevel', updatedAt: 'studentProfiles.updatedAt' },
    badges: { id: 'badges.id', code: 'badges.code', name: 'badges.name', description: 'badges.description', iconUrl: 'badges.iconUrl', xpReward: 'badges.xpReward' },
    userBadges: { id: 'userBadges.id', userId: 'userBadges.userId', badgeId: 'userBadges.badgeId', earnedAt: 'userBadges.earnedAt' },
    challenges: { id: 'challenges.id', title: 'challenges.title', description: 'challenges.description', type: 'challenges.type', targetValue: 'challenges.targetValue', xpReward: 'challenges.xpReward', startDate: 'challenges.startDate', endDate: 'challenges.endDate' },
    userChallenges: { id: 'userChallenges.id', userId: 'userChallenges.userId', challengeId: 'userChallenges.challengeId', currentValue: 'userChallenges.currentValue', isCompleted: 'userChallenges.isCompleted', completedAt: 'userChallenges.completedAt' },
    eq: jest.fn((a, b) => ({ type: 'eq', a, b })),
    and: jest.fn((...args) => ({ type: 'and', args })),
    sql: jest.fn(() => ({ type: 'sql' })),
    desc: jest.fn((col) => ({ type: 'desc', col })),
  };
});

const { mockDb, mockSelectChain, mockUpdateChain } = require('@studyai/database');

describe('GamificationService', () => {
  let service: GamificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GamificationService],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    jest.clearAllMocks();
  });

  describe('addXp', () => {
    it('should return default values if student profile does not exist', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => callback([]));

      const result = await service.addXp('user-1', 50);

      expect(result).toEqual({
        xpEarned: 50,
        totalXp: 50,
        level: 1,
        hasLeveledUp: false,
      });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should add XP and not level up if threshold is not crossed', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => callback([{
        userId: 'user-1',
        xp: 10,
        currentLevel: 1,
      }]));

      mockUpdateChain.then.mockImplementation((callback: any) => callback([{
        userId: 'user-1',
        xp: 60,
        currentLevel: 1,
      }]));

      const result = await service.addXp('user-1', 50);

      expect(result).toEqual({
        xpEarned: 50,
        totalXp: 60,
        level: 1,
        hasLeveledUp: false,
      });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should level up if threshold (100 XP per level) is crossed', async () => {
      mockSelectChain.then.mockImplementation((callback: any) => callback([{
        userId: 'user-1',
        xp: 80,
        currentLevel: 1,
      }]));

      mockUpdateChain.then.mockImplementation((callback: any) => callback([{
        userId: 'user-1',
        xp: 130,
        currentLevel: 2,
      }]));

      const result = await service.addXp('user-1', 50);

      expect(result).toEqual({
        xpEarned: 50,
        totalXp: 130,
        level: 2,
        hasLeveledUp: true,
      });
    });
  });

  describe('getBadges', () => {
    it('should return list of all badges with earned state', async () => {
      const earnedBadges = [{ id: 'badge-1', code: 'level_5', name: 'Level 5 Badge' }];
      const allBadges = [
        { id: 'badge-1', code: 'level_5', name: 'Level 5 Badge' },
        { id: 'badge-2', code: 'level_10', name: 'Level 10 Badge' },
      ];

      // First query in getBadges is for earned badges (inner join userBadges & badges)
      // Second query is for all badges
      let callCount = 0;
      mockSelectChain.then.mockImplementation((callback: any) => {
        callCount++;
        if (callCount === 1) {
          return callback(earnedBadges);
        }
        return callback(allBadges);
      });

      const result = await service.getBadges('user-1');

      expect(result.earned).toEqual(earnedBadges);
      expect(result.all).toHaveLength(2);
      expect(result.all[0].isEarned).toBe(true);
      expect(result.all[1].isEarned).toBe(false);
    });
  });
});
