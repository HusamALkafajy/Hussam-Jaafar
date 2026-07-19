import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { InfrastructureLifecycleService } from '../../infrastructure/infrastructure.module';
import { db, users, files, documentVersions, documentNodes } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { AuthService } from '../../auth/auth.service';

describe('DocumentReadController (Security Isolation)', () => {
  let app: INestApplication;
  let authService: AuthService;
  
  let userAToken: string;
  let userBToken: string;

  const userAId = 'a0000000-0000-0000-0000-000000000001';
  const userBId = 'b0000000-0000-0000-0000-000000000001';
  const fileAId = 'a0000000-0000-0000-0000-000000000002';
  const fileBId = 'b0000000-0000-0000-0000-000000000002';
  const versionA1Id = 'a0000000-0000-0000-0000-000000000003';
  const versionA2Id = 'a0000000-0000-0000-0000-000000000004';
  const versionB1Id = 'b0000000-0000-0000-0000-000000000003';
  
  const a1RootId = 'a0000000-0000-0000-0000-000000000005';
  const a2RootId = 'a0000000-0000-0000-0000-000000000006';
  const b1RootId = 'b0000000-0000-0000-0000-000000000005';
  
  beforeAll(async () => {
    // 1. Create Real Application with Real Guards

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(InfrastructureLifecycleService)
    .useValue({
      onModuleInit: jest.fn(),
      onApplicationShutdown: jest.fn(),
      onApplicationBootstrap: jest.fn(),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    
    authService = moduleFixture.get<AuthService>(AuthService);

    // 2. Seed Test Fixture
    // Insert Users
    await db.insert(users).values([
      { id: userAId, email: 'userA@iso.test', passwordHash: 'hash', firstName: 'A', lastName: 'A', isActive: true, emailVerified: true },
      { id: userBId, email: 'userB@iso.test', passwordHash: 'hash', firstName: 'B', lastName: 'B', isActive: true, emailVerified: true }
    ]).onConflictDoNothing();

    // Insert Files
    await db.insert(files).values([
      { id: fileAId, userId: userAId, processingStatus: 'completed', originalName: 'A', storageKey: 'a', storageUrl: 'a', fileType: 'pdf', mimeType: 'application/pdf', fileSize: 1 },
      { id: fileBId, userId: userBId, processingStatus: 'completed', originalName: 'B', storageKey: 'b', storageUrl: 'b', fileType: 'pdf', mimeType: 'application/pdf', fileSize: 1 }
    ]).onConflictDoNothing();

    // Insert Versions (A1 is older, A2 is newer)
    await db.insert(documentVersions).values([
      { id: versionA1Id, fileId: fileAId, versionNumber: 1, createdAt: new Date(Date.now() - 10000) },
      { id: versionA2Id, fileId: fileAId, versionNumber: 2, createdAt: new Date(Date.now() - 5000) },
      { id: versionB1Id, fileId: fileBId, versionNumber: 1 }
    ]).onConflictDoNothing();
    
    // Insert Nodes
    await db.insert(documentNodes).values([
      { id: a1RootId, versionId: versionA1Id, fileId: fileAId, parentId: null, lexoRank: 'rank-a1', nodeType: 'paragraph', content: { text: 'A_ROOT_1' } },
      { id: a2RootId, versionId: versionA2Id, fileId: fileAId, parentId: null, lexoRank: 'rank-a2', nodeType: 'paragraph', content: { text: 'A_ROOT_2' } },
      { id: b1RootId, versionId: versionB1Id, fileId: fileBId, parentId: null, lexoRank: 'rank-b1', nodeType: 'paragraph', content: { text: 'B_ROOT_SECRET' } }
    ]).onConflictDoNothing();

    // 3. Generate Real Access Tokens via AuthService
    userAToken = (await authService.login({ id: userAId, email: 'userA@iso.test', roles: ['user'] } as any)).accessToken;
    userBToken = (await authService.login({ id: userBId, email: 'userB@iso.test', roles: ['user'] } as any)).accessToken;
  });

  afterAll(async () => {
    // 4. Safe Cleanup
    await db.delete(documentNodes).where(eq(documentNodes.id, a1RootId));
    await db.delete(documentNodes).where(eq(documentNodes.id, a2RootId));
    await db.delete(documentNodes).where(eq(documentNodes.id, b1RootId));
    
    await db.delete(documentVersions).where(eq(documentVersions.id, versionA1Id));
    await db.delete(documentVersions).where(eq(documentVersions.id, versionA2Id));
    await db.delete(documentVersions).where(eq(documentVersions.id, versionB1Id));
    
    await db.delete(files).where(eq(files.id, fileAId));
    await db.delete(files).where(eq(files.id, fileBId));
    
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
    
    await app.close();
  });

  describe('A. Authentication', () => {
    it('1. Unauthenticated bootstrap is rejected (401)', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/files/${fileAId}/bootstrap`)
        .expect(401);
    });

    it('2. Unauthenticated direct node access is rejected (401)', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/versions/${versionA2Id}/nodes/${a2RootId}`)
        .expect(401);
    });
  });

  describe('B. Ownership', () => {
    it('3. User A can bootstrap File A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/files/${fileAId}/bootstrap`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.fileId).toBe(fileAId);
    });

    it('4. User A cannot bootstrap File B (404 Not Found to prevent existence oracle)', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/files/${fileBId}/bootstrap`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });

    it('5. Foreign-file and nonexistent-file responses do not create an unintended existence oracle (both 404)', async () => {
      // Foreign File
      const resForeign = await request(app.getHttpServer())
        .get(`/api/documents/files/${fileBId}/bootstrap`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resForeign.status).toBe(404);

      // Nonexistent File
      const resNonExistent = await request(app.getHttpServer())
        .get(`/api/documents/files/00000000-0000-0000-0000-000000000000/bootstrap`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resNonExistent.status).toBe(404);
    });
  });

  describe('C. Version Isolation', () => {
    it('6. File A bootstrap selects the newest readable version (A2)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/files/${fileAId}/bootstrap`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.versionId).toBe(versionA2Id);
    });

    it('7. Roots returned for Version A2 contain no Version B or A1 nodes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/files/${fileAId}/bootstrap`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.roots).toHaveLength(1);
      expect(res.body.roots[0].id).toBe(a2RootId);
      expect(res.body.roots[0].content.text).toBe('A_ROOT_2');
    });
  });

  describe('D. Node Isolation', () => {
    it('9. User A can fetch a node belonging to the authorized Version A2', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/versions/${versionA2Id}/nodes/${a2RootId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(a2RootId);
    });

    it('10. User A cannot fetch Node B using Version A scope (404)', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/versions/${versionA2Id}/nodes/${b1RootId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });

    it('11. User A cannot fetch a foreign Version B node directly using B scope (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/versions/${versionB1Id}/nodes/${b1RootId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });

    it('12. Arbitrary node UUID returns not-found behavior', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/versions/${versionA2Id}/nodes/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });
  });

  describe('E. Legacy Bypass', () => {
    it('13. Legacy global root endpoint is removed (404 on old route)', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/nodes/root/window`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });
  });

  describe('F. Cross-version isolation', () => {
    it('14. Requesting A1 node while scoped to A2 returns 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/documents/versions/${versionA2Id}/nodes/${a1RootId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);
    });
  });
});
