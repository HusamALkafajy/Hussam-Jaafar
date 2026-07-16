import { IUploadSession, IBinaryReference, IStorageProvider } from '../contracts';
import { PrismaClient } from '../../prisma-client';
import { randomUUID } from 'crypto';

export class UploadPipeline implements IUploadSession {
  public readonly sessionId: string;
  public status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED' = 'PENDING';
  private chunks: { buffer: Buffer; offset: number }[] = [];
  
  constructor(
    public readonly bucket: string,
    public readonly storageKey: string,
    private readonly provider: IStorageProvider,
    private readonly prisma: PrismaClient,
    private readonly contentType: string
  ) {
    this.sessionId = randomUUID();
  }

  async writeChunk(chunk: Buffer, offset: number): Promise<void> {
    if (this.status === 'COMPLETED' || this.status === 'FAILED') {
      throw new Error(`UploadSession is ${this.status}`);
    }
    this.status = 'UPLOADING';
    this.chunks.push({ buffer: chunk, offset });
    this.chunks.sort((a, b) => a.offset - b.offset); // Ensure order
  }

  async commit(): Promise<IBinaryReference> {
    if (this.status !== 'UPLOADING' && this.status !== 'PENDING') {
      throw new Error(`Cannot commit session in status ${this.status}`);
    }

    try {
      // 1. Reassemble chunks (Simplistic implementation for memory. Production would use multipart APIs)
      const totalLength = this.chunks.reduce((acc, chunk) => acc + chunk.buffer.length, 0);
      const completeBuffer = Buffer.alloc(totalLength);
      
      let currentOffset = 0;
      for (const chunk of this.chunks) {
        if (chunk.offset !== currentOffset) {
          throw new Error('Chunk offset mismatch - missing chunks');
        }
        chunk.buffer.copy(completeBuffer, currentOffset);
        currentOffset += chunk.buffer.length;
      }

      // Convert to stream
      const { Readable } = require('stream');
      const stream = Readable.from(completeBuffer);

      // Compute Checksum (in-memory for demo, streaming in production)
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update(completeBuffer);
      const checksumSHA256 = hash.digest('hex');

      // 2. Write to provider
      await this.provider.upload(this.bucket, this.storageKey, stream, { 
        contentType: this.contentType, 
        contentLength: totalLength 
      });

      // 3. Write metadata to Prisma
      const metadata = await this.prisma.binaryObjectMetadata.upsert({
        where: { bucket_storageKey: { bucket: this.bucket, storageKey: this.storageKey } },
        create: {
          storageProvider: 'LocalDisk', // Hardcoded for adapter simplicity
          bucket: this.bucket,
          storageKey: this.storageKey,
          checksumSHA256,
          contentLength: BigInt(totalLength),
          contentType: this.contentType,
          uploadStatus: 'COMPLETED'
        },
        update: {
          checksumSHA256,
          contentLength: BigInt(totalLength),
          contentType: this.contentType,
          uploadStatus: 'COMPLETED',
          version: { increment: 1 }
        }
      });

      this.status = 'COMPLETED';

      return {
        objectId: metadata.objectId,
        bucket: metadata.bucket,
        storageKey: metadata.storageKey,
        checksumSHA256: metadata.checksumSHA256 || undefined,
        contentLength: Number(metadata.contentLength),
        contentType: metadata.contentType,
        version: metadata.version
      };

    } catch (error) {
      this.status = 'FAILED';
      throw error;
    }
  }

  async abort(): Promise<void> {
    this.status = 'FAILED';
    this.chunks = []; // clear memory
  }
}
