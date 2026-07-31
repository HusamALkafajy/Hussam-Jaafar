import { IStorageProvider } from '../contracts';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir, stat, unlink } from 'fs/promises';

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
    await mkdir(path.dirname(filePath), { recursive: true });
    
    const writeStream = fs.createWriteStream(filePath);
    return new Promise((resolve, reject) => {
      stream.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
      stream.on('error', reject);
    });
  }

  async download(bucket: string, key: string, range?: { start: number; end: number }): Promise<Readable> {
    const filePath = this.getFilePath(bucket, key);
    
    if (range) {
      return fs.createReadStream(filePath, { start: range.start, end: range.end });
    }
    return fs.createReadStream(filePath);
  }

  async delete(bucket: string, key: string): Promise<void> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    const filePath = this.getFilePath(bucket, key);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getSize(bucket: string, key: string): Promise<number> {
    const filePath = this.getFilePath(bucket, key);
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
