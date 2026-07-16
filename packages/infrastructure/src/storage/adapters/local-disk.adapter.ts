import { IStorageProvider } from '../contracts';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir, stat, unlink } from 'fs/promises';

export class LocalDiskStorageProvider implements IStorageProvider {
  constructor(private readonly basePath: string) {}

  private getFilePath(bucket: string, key: string): string {
    return path.join(this.basePath, bucket, key);
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
