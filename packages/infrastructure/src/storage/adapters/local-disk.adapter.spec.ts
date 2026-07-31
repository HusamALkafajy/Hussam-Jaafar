declare var describe: any;
declare var it: any;
declare var expect: any;
declare var beforeEach: any;
declare var afterEach: any;
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { LocalDiskStorageProvider } from './local-disk.adapter';

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

  it('persists an opaque key and supports a byte range', async () => {
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
});
