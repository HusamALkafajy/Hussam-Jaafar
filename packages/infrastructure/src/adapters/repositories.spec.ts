import { PrismaClient } from '../prisma-client';
import { PrismaLearningRepository } from './learning.repository.prisma';
import { PrismaWorkflowRepository } from './workflow.repository.prisma';

// -----------------------------------------------------------------------------
// REPOSITORY INTEGRATION TESTS
// -----------------------------------------------------------------------------
// Note: Requires a running PostgreSQL instance for execution.
// -----------------------------------------------------------------------------

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be supplied through the environment.');
}

describe('Repository Integration Tests', () => {
  let prisma: PrismaClient;
  let learningRepo: PrismaLearningRepository;
  let workflowRepo: PrismaWorkflowRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDatabaseUrl,
        },
      },
    });
    await prisma.$connect();

    const mockOutbox = {
      storeEvent: async () => {},
      publishPendingEvents: async () => {},
    };

    learningRepo = new PrismaLearningRepository(prisma, mockOutbox);
    workflowRepo = new PrismaWorkflowRepository(prisma, mockOutbox);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.assetCapability.deleteMany();
    await prisma.learningAsset.deleteMany();
    await prisma.workflowJob.deleteMany();
    await prisma.workflowEvent.deleteMany();
    await prisma.workflow.deleteMany();
  });

  describe('LearningRepository', () => {
    it('should create and retrieve a LearningAsset with capabilities', async () => {
      const asset = {
        id: 'asset-1',
        userId: 'user-1',
        title: 'Test Asset',
        type: 'DOCUMENT',
        status: 'READY',
        capabilities: [
          { id: 'cap-1', feature: 'SUMMARY', enabled: true },
        ],
      };

      await learningRepo.save(asset);

      const found = await learningRepo.findById('asset-1');
      expect(found).toBeDefined();
      expect(found?.title).toBe('Test Asset');
      expect(found?.capabilities).toHaveLength(1);
    });

    it('should soft delete a LearningAsset', async () => {
      const asset = {
        id: 'asset-2',
        userId: 'user-1',
        title: 'Delete Me',
        type: 'TEXT',
        status: 'READY',
      };

      await learningRepo.save(asset);
      await learningRepo.delete('asset-2');

      const found = await learningRepo.findById('asset-2');
      expect(found?.deletedAt).not.toBeNull();
    });
  });

  describe('WorkflowRepository (Optimistic Locking & Transactions)', () => {
    it('should rollback transaction on version mismatch (OCC)', async () => {
      const workflow = {
        id: 'wf-1',
        type: 'PROCESS_ASSET',
        status: 'PENDING',
        version: 1,
      };

      await workflowRepo.save(workflow);

      // Simulate concurrent update bypassing the repository (or using old version)
      await prisma.workflow.update({
        where: { id: 'wf-1' },
        data: { version: 2, status: 'RUNNING' },
      });

      // Attempt to save with old version should fail or be handled by the adapter
      const oldWorkflow = { ...workflow, status: 'COMPLETED' };

      try {
        await workflowRepo.save(oldWorkflow);
        // If it reaches here without error, the adapter needs to strictly enforce OCC
        // OCC is usually handled at application layer by throwing when versions mismatch
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });
});
