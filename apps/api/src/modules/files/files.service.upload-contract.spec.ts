import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from './files.service';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_CHUNK_BYTES,
  UploadErrorCode,
  UploadException,
} from '../../common/files/upload-contract';

jest.mock('@studyai/database', () => ({
  db: {},
  files: {},
  subscriptions: {},
  users: {},
  subjects: {},
  fileProcessingAttempts: {},
  documentVersions: {},
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
}));

const UPLOAD_ONE = '35b513fc-8162-4e05-93f0-ec6f7da0dc0b';
const UPLOAD_TWO = '45b513fc-8162-4e05-93f0-ec6f7da0dc0b';
const UPLOAD_THREE = '55b513fc-8162-4e05-93f0-ec6f7da0dc0b';
const SUBJECT_ID = '8b10ae20-f1b2-4c4a-91d9-61d408606de1';
const TEST_NOW = Date.parse('2026-08-26T00:00:00.000Z');

describe('FilesService chunk upload rejection and recovery contract', () => {
  let root: string;
  let outsideRoots: string[];
  let service: FilesService;
  let register: jest.Mock;
  let quotaAdmission: jest.Mock;
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let firstChunk: Buffer;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'studyai-upload-unit-'));
    outsideRoots = [];
    service = Object.create(FilesService.prototype) as FilesService;
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    register = jest.fn();
    quotaAdmission = jest.fn().mockResolvedValue(false);
    Object.assign(service as any, {
      uploadDir: root,
      logger,
      registerAndProcessFile: register,
      assertUploadQuotaAvailable: quotaAdmission,
      temporaryUploadTtlMs: 1_000,
      temporaryUploadSweepIntervalMs: 500,
      temporaryUploadSweepInProgress: false,
      temporaryUploadLocks: new Map<string, Promise<void>>(),
    });
    firstChunk = Buffer.alloc(UPLOAD_CHUNK_BYTES);
    firstChunk.write('%PDF');
    jest.spyOn(Date, 'now').mockReturnValue(TEST_NOW);
  });

  afterEach(async () => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
    await Promise.all(outsideRoots.map((directory) => rm(directory, { recursive: true, force: true })));
  });

  function quotaError(): UploadException {
    return new UploadException(
      UploadErrorCode.QUOTA_EXCEEDED,
      'Monthly file upload limit exceeded.',
      403,
      { limitType: 'files', used: 10, limit: 10, tier: 'free' },
    );
  }

  async function uploadFirstChunk(
    uploadId = UPLOAD_ONE,
    userId = 'user-1',
    filename = 'book.pdf',
  ): Promise<unknown> {
    return service.handleChunkUpload(
      userId,
      firstChunk,
      uploadId,
      0,
      2,
      filename,
      UPLOAD_CHUNK_BYTES + 1,
      'application/pdf',
    );
  }

  async function uploadFinalChunk(
    uploadId = UPLOAD_ONE,
    userId = 'user-1',
    filename = 'book.pdf',
  ): Promise<unknown> {
    return service.handleChunkUpload(
      userId,
      Buffer.from('x'),
      uploadId,
      1,
      2,
      filename,
      UPLOAD_CHUNK_BYTES + 1,
      'application/pdf',
    );
  }

  async function tempEntries(): Promise<string[]> {
    return readdir(join(root, 'temp')).catch(() => []);
  }

  async function expectNoTemporaryUploadState(): Promise<void> {
    expect(await tempEntries()).toEqual([]);
  }

  async function seedManifest(
    uploadId: string,
    options: {
      expired?: boolean;
      includeFirstChunk?: boolean;
      malformed?: boolean;
      includeAssembled?: boolean;
    } = {},
  ): Promise<string> {
    const directory = join(root, 'temp', uploadId);
    await mkdir(directory, { recursive: true });
    if (options.malformed) {
      await writeFile(join(directory, 'manifest.json'), '{not-json');
    } else {
      const createdAt = options.expired ? TEST_NOW - 2_000 : TEST_NOW;
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({
        userId: 'user-1',
        filename: 'book.pdf',
        fileSize: UPLOAD_CHUNK_BYTES + 1,
        mimeType: 'application/pdf',
        totalChunks: 2,
        createdAt: new Date(createdAt).toISOString(),
        expiresAt: new Date(createdAt + 1_000).toISOString(),
      }));
    }
    if (options.includeFirstChunk) {
      await writeFile(join(directory, 'chunk_0'), firstChunk);
    }
    if (options.includeAssembled) {
      await writeFile(join(directory, 'assembled.pdf'), Buffer.from('%PDF'));
    }
    return directory;
  }

  it('rejects one byte over 50 MiB before persistence, storage, or queue dispatch', async () => {
    await expect(service.handleChunkUpload(
      'user-1',
      Buffer.from('%PDF'),
      UPLOAD_ONE,
      0,
      26,
      'book.pdf',
      MAX_UPLOAD_BYTES + 1,
      'application/pdf',
    )).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'FILE_TOO_LARGE' }) });
    await expectNoTemporaryUploadState();
    expect(register).not.toHaveBeenCalled();
    expect(quotaAdmission).not.toHaveBeenCalled();
  });

  it('rejects unsupported or forged content without temporary residue', async () => {
    await expect(service.handleChunkUpload(
      'user-1',
      Buffer.from('fake'),
      UPLOAD_ONE,
      0,
      1,
      'book.pdf',
      4,
      'application/pdf',
    )).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'UNSUPPORTED_FILE_TYPE' }) });
    await expectNoTemporaryUploadState();
    expect(register).not.toHaveBeenCalled();
    expect(quotaAdmission).not.toHaveBeenCalled();
  });

  it('rejects a capped first chunk before any temporary or downstream side effect', async () => {
    quotaAdmission.mockRejectedValueOnce(quotaError());
    await expect(uploadFirstChunk()).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'QUOTA_EXCEEDED' }),
    });
    await expectNoTemporaryUploadState();
    expect(register).not.toHaveBeenCalled();
    expect(quotaAdmission).toHaveBeenCalledTimes(1);
  });

  it('accepts a below-limit first chunk with an explicit bounded lifetime', async () => {
    await expect(uploadFirstChunk()).resolves.toMatchObject({ success: true });
    const manifest = JSON.parse(await readFile(join(root, 'temp', UPLOAD_ONE, 'manifest.json'), 'utf8'));
    expect(Date.parse(manifest.expiresAt) - Date.parse(manifest.createdAt)).toBe(1_000);
    expect(await readdir(join(root, 'temp', UPLOAD_ONE))).toEqual(['chunk_0', 'manifest.json']);
  });

  it('keeps the finalization quota check and removes all state when quota changes', async () => {
    await uploadFirstChunk();
    register.mockRejectedValueOnce(quotaError());
    await expect(uploadFinalChunk()).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'QUOTA_EXCEEDED' }),
    });
    expect(register).toHaveBeenCalledTimes(1);
    await expectNoTemporaryUploadState();
  });

  it('preserves an interrupted upload before expiry', async () => {
    await uploadFirstChunk();
    jest.spyOn(Date, 'now').mockReturnValue(TEST_NOW + 999);
    await expect((service as any).reconcileTemporaryUploads('manual')).resolves.toMatchObject({
      removed: 0,
      preserved: 1,
    });
    expect(await tempEntries()).toEqual([UPLOAD_ONE]);
  });

  it('removes an interrupted upload after expiry', async () => {
    await uploadFirstChunk();
    jest.spyOn(Date, 'now').mockReturnValue(TEST_NOW + 1_001);
    await expect((service as any).reconcileTemporaryUploads('manual')).resolves.toMatchObject({
      removed: 1,
    });
    await expectNoTemporaryUploadState();
  });

  it('reconciles stale residue during service startup', async () => {
    await seedManifest(UPLOAD_ONE, { expired: true, includeFirstChunk: true });
    await service.onModuleInit();
    await expectNoTemporaryUploadState();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('"reason":"startup"'));
  });

  it('does not delete a locked active upload during reconciliation', async () => {
    await seedManifest(UPLOAD_ONE, { expired: true, includeFirstChunk: true });
    (service as any).temporaryUploadLocks.set(UPLOAD_ONE, new Promise<void>(() => undefined));
    await expect((service as any).reconcileTemporaryUploads('manual')).resolves.toMatchObject({
      removed: 0,
      preserved: 1,
    });
    expect(await tempEntries()).toEqual([UPLOAD_ONE]);
  });

  it('removes an orphan manifest without any chunk', async () => {
    await seedManifest(UPLOAD_ONE);
    await (service as any).reconcileTemporaryUploads('manual');
    await expectNoTemporaryUploadState();
  });

  it('removes orphan chunks without a valid manifest', async () => {
    const directory = join(root, 'temp', UPLOAD_ONE);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'chunk_0'), firstChunk);
    await (service as any).reconcileTemporaryUploads('manual');
    await expectNoTemporaryUploadState();
  });

  it('removes malformed metadata without exposing it in cleanup logs', async () => {
    await seedManifest(UPLOAD_ONE, { malformed: true, includeFirstChunk: true });
    await (service as any).reconcileTemporaryUploads('manual');
    await expectNoTemporaryUploadState();
    const logs = JSON.stringify(logger.log.mock.calls);
    expect(logs).not.toContain(root);
    expect(logs).not.toContain(UPLOAD_ONE);
    expect(logs).not.toContain('user-1');
    expect(logs).not.toContain('book.pdf');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('makes repeated cleanup idempotent', async () => {
    await seedManifest(UPLOAD_ONE, { expired: true, includeFirstChunk: true });
    await expect((service as any).reconcileTemporaryUploads('manual')).resolves.toMatchObject({ removed: 1 });
    await expect((service as any).reconcileTemporaryUploads('manual')).resolves.toMatchObject({ removed: 0 });
    await expectNoTemporaryUploadState();
  });

  it('makes simultaneous cleanup attempts safe and non-overlapping', async () => {
    await seedManifest(UPLOAD_ONE, { expired: true, includeFirstChunk: true });
    const results = await Promise.all([
      (service as any).reconcileTemporaryUploads('manual'),
      (service as any).reconcileTemporaryUploads('manual'),
    ]);
    expect(results.reduce((count, result) => count + result.removed, 0)).toBe(1);
    expect(results.some((result) => result.skipped)).toBe(true);
    await expectNoTemporaryUploadState();
  });

  it('isolates users and upload IDs without deleting another user upload', async () => {
    await uploadFirstChunk(UPLOAD_ONE, 'user-1', 'one.pdf');
    await uploadFirstChunk(UPLOAD_TWO, 'user-2', 'two.pdf');
    await expect(uploadFinalChunk(UPLOAD_ONE, 'user-2', 'one.pdf')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'INVALID_UPLOAD' }),
    });
    expect((await tempEntries()).sort()).toEqual([UPLOAD_ONE, UPLOAD_TWO].sort());

    register.mockImplementationOnce(async (_userId: string, filePath: string) => {
      await unlink(filePath);
      return { id: 'file-1' };
    });
    await expect(uploadFinalChunk(UPLOAD_ONE, 'user-1', 'one.pdf')).resolves.toMatchObject({ id: 'file-1' });
    expect(await tempEntries()).toEqual([UPLOAD_TWO]);
  });

  it('rejects path traversal before creating temporary state', async () => {
    await expect(uploadFirstChunk('../outside')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'INVALID_UPLOAD' }),
    });
    expect(await readdir(root)).toEqual([]);
    expect(quotaAdmission).not.toHaveBeenCalled();
  });

  it('preserves the selected subject and confirmed title through single-chunk registration', async () => {
    register.mockImplementation(async (
      _userId: string,
      filePath: string,
      _filename: string,
      _mime: string,
      _size: number,
      subjectId: string,
      title: string,
    ) => {
      await unlink(filePath);
      return { id: 'file-1', subjectId, title };
    });
    await expect(service.handleChunkUpload(
      'user-1',
      Buffer.from('%PDF'),
      UPLOAD_ONE,
      0,
      1,
      'book.pdf',
      4,
      'application/pdf',
      SUBJECT_ID,
      'كتاب الجبر',
    )).resolves.toMatchObject({
      subjectId: SUBJECT_ID,
      title: 'كتاب الجبر',
    });
    expect(register).toHaveBeenCalledWith(
      'user-1',
      expect.stringContaining('assembled.pdf'),
      'book.pdf',
      'application/pdf',
      4,
      SUBJECT_ID,
      'كتاب الجبر',
    );
    await expectNoTemporaryUploadState();
  });

  it('preserves successful multi-chunk registration', async () => {
    await uploadFirstChunk();
    register.mockImplementationOnce(async (_userId: string, filePath: string) => {
      expect((await lstat(filePath)).size).toBe(UPLOAD_CHUNK_BYTES + 1);
      await unlink(filePath);
      return { id: 'file-2' };
    });
    await expect(uploadFinalChunk()).resolves.toMatchObject({ id: 'file-2' });
    expect(register).toHaveBeenCalledTimes(1);
    await expectNoTemporaryUploadState();
  });

  it('keeps metadata mismatch cleanup behavior', async () => {
    await uploadFirstChunk();
    await expect(uploadFinalChunk(UPLOAD_ONE, 'user-1', 'changed.pdf')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'INVALID_UPLOAD' }),
    });
    await expectNoTemporaryUploadState();
  });

  it('keeps duplicate-chunk rejection cleanup behavior', async () => {
    await uploadFirstChunk();
    await expect(uploadFirstChunk()).rejects.toBeDefined();
    await expectNoTemporaryUploadState();
  });

  it('serializes concurrent finalization and registers at most once', async () => {
    await uploadFirstChunk();
    register.mockImplementationOnce(async (_userId: string, filePath: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await unlink(filePath);
      return { id: 'file-3' };
    });
    const settled = await Promise.allSettled([uploadFinalChunk(), uploadFinalChunk()]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(register).toHaveBeenCalledTimes(1);
    await expectNoTemporaryUploadState();
  });

  it('removes interrupted finalization residue during reconciliation', async () => {
    await seedManifest(UPLOAD_ONE, { includeFirstChunk: true, includeAssembled: true });
    await (service as any).reconcileTemporaryUploads('manual');
    await expectNoTemporaryUploadState();
  });

  it('unlinks a validated upload-ID symlink without following it', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'studyai-upload-outside-'));
    outsideRoots.push(outside);
    const sentinel = join(outside, 'sentinel');
    await writeFile(sentinel, 'preserve');
    await mkdir(join(root, 'temp'), { recursive: true });
    await symlink(outside, join(root, 'temp', UPLOAD_THREE), process.platform === 'win32' ? 'junction' : 'dir');

    await (service as any).reconcileTemporaryUploads('manual');

    await expect(readFile(sentinel, 'utf8')).resolves.toBe('preserve');
    await expect(lstat(join(root, 'temp', UPLOAD_THREE))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('releases the unrefed lifecycle timer during shutdown', async () => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
    await service.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
