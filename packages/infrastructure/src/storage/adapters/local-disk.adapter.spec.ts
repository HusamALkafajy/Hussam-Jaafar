declare var describe: any;
declare var it: any;
declare var expect: any;
declare var beforeEach: any;
declare var afterEach: any;
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { Readable } from 'stream';
import {
  LocalDiskStorageProvider,
  LocalStorageOperationError,
  resolveLocalStorageRoot,
} from './local-disk.adapter';

async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

describe('LocalDiskStorageProvider', () => {
  let root: string;
  let provider: LocalDiskStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'studyai-storage-'));
    provider = new LocalDiskStorageProvider(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates nested directories, persists an opaque key, and supports a byte range', async () => {
    await provider.upload('documents', 'user-a/original.pdf', Readable.from(Buffer.from('abcdef')));

    expect(await provider.exists('documents', 'user-a/original.pdf')).toBe(true);
    expect(await provider.getSize('documents', 'user-a/original.pdf')).toBe(6);
    await expect(readAll(await provider.download('documents', 'user-a/original.pdf', { start: 2, end: 4 }))).resolves.toBe('cde');
    await expect(provider.delete('documents', 'user-a/original.pdf')).resolves.toBeUndefined();
    expect(await provider.exists('documents', 'user-a/original.pdf')).toBe(false);
  });

  it('rejects absolute and traversal keys across operations', async () => {
    const invalidKeys = [
      '../outside.pdf',
      '..\\outside.pdf',
      'folder/../../outside.pdf',
      'folder\\..\\..\\outside.pdf',
      '/absolute/outside.pdf',
      'C:\\outside.pdf',
      'C:/outside.pdf',
      '\\\\server\\share\\outside.pdf',
      '.',
      '..',
      'folder/..',
      'folder\\..',
      '../documents-evil/prefix-confusion',
      '%2e%2e%2foutside.pdf',
      '%2e%2e%5coutside.pdf',
      '',
      '\0',
      'folder/\0/file'
    ];

    for (const key of invalidKeys) {
      const decodedKey = decodeURIComponent(key);
      try {
        await expect(provider.upload('documents', decodedKey, Readable.from(Buffer.from('x')))).rejects.toThrow();
        await expect(provider.download('documents', decodedKey)).rejects.toThrow();
        await expect(provider.exists('documents', decodedKey)).rejects.toThrow();
        await expect(provider.getSize('documents', decodedKey)).rejects.toThrow();
        await expect(provider.delete('documents', decodedKey)).rejects.toThrow();
      } catch (e) {
        throw new Error(`Failed on key: ${key}. Error: ${e}`);
      }
    }
  });

  it('rejects invalid bucket names', async () => {
    const invalidBuckets = [
      '../documents',
      '..\\documents',
      '/absolute/documents',
      'C:\\documents',
      '.',
      '..'
    ];

    for (const bucket of invalidBuckets) {
      await expect(provider.upload(bucket, 'file.pdf', Readable.from(Buffer.from('x')))).rejects.toThrow();
      await expect(provider.download(bucket, 'file.pdf')).rejects.toThrow();
    }
  });

  it('fails safely without disclosing the configured path when storage is unavailable', async () => {
    const unavailableRoot = join(root, 'unavailable-root');
    await writeFile(unavailableRoot, 'not a directory');
    const unavailableProvider = new LocalDiskStorageProvider(unavailableRoot);

    let failure: unknown;
    try {
      await unavailableProvider.upload(
        'documents',
        'user-a/original.pdf',
        Readable.from(Buffer.from('x')),
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(LocalStorageOperationError);
    expect((failure as Error).message).toBe('Local storage write failed.');
    expect((failure as Error).message).not.toContain(unavailableRoot);
    expect((failure as Error).message).not.toContain('user-a/original.pdf');
  });
});

describe('resolveLocalStorageRoot', () => {
  it('resolves the configured storage root from the supplied working directory', () => {
    expect(
      resolveLocalStorageRoot(
        { NODE_ENV: 'production', STORAGE_PATH: './durable-documents' },
        '/srv/studyai',
      ),
    ).toBe(resolve('/srv/studyai', 'durable-documents'));
  });

  it('uses a local development root but fails closed in production', () => {
    expect(resolveLocalStorageRoot({ NODE_ENV: 'development' }, '/srv/studyai')).toBe(
      resolve('/srv/studyai', '.storage'),
    );
    expect(() => resolveLocalStorageRoot({ NODE_ENV: 'production' }, '/srv/studyai')).toThrow(
      'STORAGE_PATH is required when NODE_ENV=production.',
    );
  });
});
