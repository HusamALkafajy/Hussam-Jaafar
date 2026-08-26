import { IStorageProvider } from '../contracts';
import { PassThrough, Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir, stat, unlink } from 'fs/promises';

type StorageEnvironment = Readonly<{
  NODE_ENV?: string;
  STORAGE_PATH?: string;
}>;

export class LocalStorageOperationError extends Error {
  readonly code = 'LOCAL_STORAGE_OPERATION_FAILED';

  constructor(operation: 'read' | 'write' | 'delete' | 'inspect') {
    super(`Local storage ${operation} failed.`);
    this.name = 'LocalStorageOperationError';
  }
}

export function resolveLocalStorageRoot(
  environment: StorageEnvironment = process.env,
  workingDirectory: string = process.cwd(),
): string {
  const configuredPath = environment.STORAGE_PATH?.trim();

  if (!configuredPath) {
    if (environment.NODE_ENV === 'production') {
      throw new Error('STORAGE_PATH is required when NODE_ENV=production.');
    }

    return path.resolve(workingDirectory, '.storage');
  }

  return path.resolve(workingDirectory, configuredPath);
}

export class LocalDiskStorageProvider implements IStorageProvider {
  private readonly resolvedBasePath: string;

  constructor(private readonly basePath: string) {
    this.resolvedBasePath = path.resolve(basePath);
  }

  private getFilePath(bucket: string, key: string): string {
    if (!bucket || !key || path.isAbsolute(bucket) || path.isAbsolute(key)) {
      throw new Error('Invalid object storage key.');
    }

    const bucketRoot = path.resolve(this.resolvedBasePath, bucket);
    const relBucket = path.relative(this.resolvedBasePath, bucketRoot);
    if (!relBucket || relBucket === '..' || relBucket.startsWith(`..${path.sep}`) || path.isAbsolute(relBucket)) {
      throw new Error('Invalid bucket name.');
    }

    const resolvedPath = path.resolve(bucketRoot, key);
    const relCandidate = path.relative(bucketRoot, resolvedPath);
    if (!relCandidate || relCandidate === '..' || relCandidate.startsWith(`..${path.sep}`) || path.isAbsolute(relCandidate)) {
      throw new Error('Object storage key escapes the configured bucket directory.');
    }

    return resolvedPath;
  }

  async upload(bucket: string, key: string, stream: Readable, options?: { contentType?: string, contentLength?: number }): Promise<void> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await mkdir(path.dirname(filePath), { recursive: true });

      const writeStream = fs.createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        stream.once('error', reject);
        writeStream.once('finish', resolve);
        writeStream.once('error', reject);
        stream.pipe(writeStream);
      });
    } catch {
      throw new LocalStorageOperationError('write');
    }
  }

  async download(bucket: string, key: string, range?: { start: number; end: number }): Promise<Readable> {
    const filePath = this.getFilePath(bucket, key);
    
    const source = range
      ? fs.createReadStream(filePath, { start: range.start, end: range.end })
      : fs.createReadStream(filePath);
    const output = new PassThrough();

    source.once('error', () => output.destroy(new LocalStorageOperationError('read')));
    source.pipe(output);

    return output;
  }

  async delete(bucket: string, key: string): Promise<void> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw new LocalStorageOperationError('delete');
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await stat(filePath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') return false;
      throw new LocalStorageOperationError('inspect');
    }
  }

  async getSize(bucket: string, key: string): Promise<number> {
    const filePath = this.getFilePath(bucket, key);
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch (error: any) {
      if (error.code === 'ENOENT') return 0;
      throw new LocalStorageOperationError('inspect');
    }
  }
}
