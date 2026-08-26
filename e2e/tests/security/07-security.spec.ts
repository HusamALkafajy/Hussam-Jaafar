/**
 * security/07-security.spec.ts — Security Certification Suite
 *
 * Validates the real security policy implemented by the NestJS backend.
 *
 * Authorization matrix (per files.service.ts implementation):
 *   - Missing/invalid JWT → 401 Unauthorized
 *   - User A accessing User B's file → 404 Not Found
 *     (backend uses findById with AND userId condition — returns NotFoundException)
 *   - Quota exceeded → 403 Forbidden
 *   - Unsupported file type → 400 Bad Request
 *   - Valid authenticated request → 200 OK
 */
import { test, expect } from '../../fixtures/index';
import { createTestUser } from '../../helpers/auth';
import { uploadFileViaAPI, waitForProcessing, verifyFileIsolation } from '../../helpers/api';
import path from 'path';
import fs from 'fs';

const SAMPLE_PDF = path.join(__dirname, '..', '..', 'fixtures', 'files', 'sample.pdf');
const UNSUPPORTED_TXT = path.join(__dirname, '..', '..', 'fixtures', 'files', 'unsupported.txt');
const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

test.describe('07 · Security', () => {
  // ── Authentication enforcement ────────────────────────────────────────

  test('GET /api/files without token returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/files`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/files with invalid JWT returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/files`, {
      headers: { Authorization: 'Bearer this.is.invalid' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/auth/login with wrong password returns 401', async ({ request }) => {
    const user = await createTestUser(request);
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: user.email, password: 'WrongPassword!' },
    });
    expect(res.status()).toBe(401);
  });

  // ── Cross-user file isolation ─────────────────────────────────────────

  test('User A cannot access User B file — returns 404', async ({ request }) => {
    // Create two independent users
    const userA = await createTestUser(request);
    const userB = await createTestUser(request);

    // User B uploads a file
    const fileBuffer = fs.readFileSync(SAMPLE_PDF);
    const fileBRecord = await uploadFileViaAPI(
      request, userB.accessToken, fileBuffer, 'user-b-file.pdf', 'application/pdf'
    );

    // User A attempts to access User B's file
    // Per backend: findById uses AND(eq(files.id, id), eq(files.userId, userId))
    // Returns 0 rows → NotFoundException → 404
    await verifyFileIsolation(request, userA.accessToken, fileBRecord.id);
  });

  test('User A cannot delete User B file — returns 404', async ({ request }) => {
    const userA = await createTestUser(request);
    const userB = await createTestUser(request);

    const fileBuffer = fs.readFileSync(SAMPLE_PDF);
    const fileBRecord = await uploadFileViaAPI(
      request, userB.accessToken, fileBuffer, 'user-b-del.pdf', 'application/pdf'
    );

    // User A tries to delete User B's file
    const res = await request.delete(`${API_BASE}/api/files/${fileBRecord.id}`, {
      headers: { Authorization: `Bearer ${userA.accessToken}` },
    });
    // Should fail — 404 because the userId filter means the record isn't found
    expect([404, 403]).toContain(res.status());
  });

  // ── File validation ───────────────────────────────────────────────────

  test('uploading unsupported file type (.txt) returns 400', async ({ request, authenticatedUser }) => {
    const token = authenticatedUser.accessToken;
    const fileBuffer = fs.readFileSync(UNSUPPORTED_TXT);

    const res = await request.post(`${API_BASE}/api/files/upload/chunk`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        uploadId: `e2e-txt-${Date.now()}`,
        chunkIndex: '0',
        totalChunks: '1',
        filename: 'unsupported.txt',
        file: {
          name: 'unsupported.txt',
          mimeType: 'text/plain',
          buffer: fileBuffer,
        },
      },
    });

    // Backend throws BadRequestException for unsupported MIME types
    expect(res.status()).toBe(400);
  });

  // ── Authorization header validation ──────────────────────────────────

  test('valid authenticated request to /api/files returns 200', async ({
    request,
    authenticatedUser,
  }) => {
    const res = await request.get(`${API_BASE}/api/files`, {
      headers: { Authorization: `Bearer ${authenticatedUser.accessToken}` },
    });
    expect(res.status()).toBe(200);
  });

  test('/api/auth/me returns current user for valid token', async ({
    request,
    authenticatedUser,
  }) => {
    const res = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authenticatedUser.accessToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const meUser = body.data?.user || body.data || body;
    expect(meUser.email).toBe(authenticatedUser.email);
  });

  // ── Non-existent resource isolation ──────────────────────────────────

  test('accessing a random UUID file ID returns 404', async ({
    request,
    authenticatedUser,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request.get(`${API_BASE}/api/files/${fakeId}`, {
      headers: { Authorization: `Bearer ${authenticatedUser.accessToken}` },
    });
    expect(res.status()).toBe(404);
  });
});
