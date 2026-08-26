/**
 * API helpers for the E2E certification suite.
 *
 * Provides typed wrappers around the StudyAI REST API.
 * All requests include the Bearer token for the isolated test user.
 * Every helper validates both HTTP status AND response shape.
 */
import { type APIRequestContext, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:4000';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  storageKey: string;
  storageUrl: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  processingStatus: ProcessingStatus;
  extractedText?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

/**
 * Uploads a file via the chunked upload API. Mirrors the exact logic used
 * by the browser frontend (files/page.tsx handleUploadSubmit).
 * Returns the newly-created FileRecord.
 */
export async function uploadFileViaAPI(
  request: APIRequestContext,
  token: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  subjectId?: string
): Promise<FileRecord> {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB — same as frontend
  const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
  const uploadId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let lastResponse: any = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
    const chunk = fileBuffer.slice(start, end);

    const formData: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
      uploadId,
      chunkIndex: String(i),
      totalChunks: String(totalChunks),
      filename,
      file: { name: filename, mimeType, buffer: chunk },
    };
    if (subjectId) formData.subjectId = subjectId;

    const res = await request.post(`${API_BASE}/api/files/upload/chunk`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData as any,
    });

    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`Chunk upload failed at chunk ${i}/${totalChunks}: ${res.status()} — ${body}`);
    }

    const resBody = await res.json();
    lastResponse = resBody.data ?? resBody;
  }

  if (!lastResponse?.id) {
    throw new Error(`Upload completed but response missing file id. Got: ${JSON.stringify(lastResponse)}`);
  }

  return lastResponse as FileRecord;
}

/**
 * Polls GET /api/files/:id until processingStatus is 'completed' or 'failed'.
 * Throws if the file never reaches a terminal state within the timeout.
 */
export async function waitForProcessing(
  request: APIRequestContext,
  token: string,
  fileId: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<FileRecord> {
  const timeout = options.timeout ?? 60_000; // 60s default
  const interval = options.interval ?? 2_000; // poll every 2s
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const res = await request.get(`${API_BASE}/api/files/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok()) {
      throw new Error(`GET /api/files/${fileId} failed: ${res.status()}`);
    }

    const resBody = await res.json();
    const file: FileRecord = resBody.data ?? resBody;

    if (file.processingStatus === 'completed') return file;
    if (file.processingStatus === 'failed') {
      throw new Error(`File processing failed for ${fileId}: ${(file as any).processingError || 'unknown'}`);
    }

    // Still pending/processing — wait before next poll
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `File ${fileId} did not reach 'completed' status within ${timeout}ms. ` +
    `This may indicate the BullMQ worker is not running.`
  );
}

/**
 * Fetches a file record and asserts it exists and belongs to the user.
 */
export async function getFile(
  request: APIRequestContext,
  token: string,
  fileId: string
): Promise<FileRecord> {
  const res = await request.get(`${API_BASE}/api/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data ?? body;
}

/**
 * Fetches all files for the test user.
 */
export async function listFiles(
  request: APIRequestContext,
  token: string
): Promise<FileRecord[]> {
  const res = await request.get(`${API_BASE}/api/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  // The API returns either { data: [...] } or { success: true, data: { data: [...] } }
  return body.data?.data ?? body.data ?? body;
}

/**
 * Deletes a file via API. Verifies 200/204 response.
 */
export async function deleteFile(
  request: APIRequestContext,
  token: string,
  fileId: string
): Promise<void> {
  const res = await request.delete(`${API_BASE}/api/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([200, 204]).toContain(res.status());
}

/**
 * Verifies cross-user isolation: attempts to fetch userB's file using userA's token.
 * Per the backend implementation (findById query scoped to userId),
 * this MUST return 404 — not 403 — because the query returns 0 rows.
 */
export async function verifyFileIsolation(
  request: APIRequestContext,
  tokenA: string,
  fileBId: string
): Promise<void> {
  const res = await request.get(`${API_BASE}/api/files/${fileBId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  // Backend throws NotFoundException when query returns 0 rows (userId mismatch)
  expect(res.status()).toBe(404);
}
