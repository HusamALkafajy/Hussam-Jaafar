import { IObjectStorage, IBinaryObject, IBinaryReference, IUploadSession, IDownloadSession, IStorageProvider } from './contracts';
import { Readable } from 'stream';
import { PrismaClient } from '../prisma-client';
import { UploadPipeline } from './pipelines/upload-pipeline';
import { DownloadPipeline } from './pipelines/download-pipeline';

export class ObjectStoragePlatform implements IObjectStorage {
  constructor(
    private readonly provider: IStorageProvider,
    private readonly prisma: PrismaClient
  ) {}

  async put(bucket: string, key: string, stream: Readable, options?: { contentType?: string, contentLength?: number }): Promise<IBinaryReference> {
    const session = await this.createUploadSession(bucket, key, options?.contentType || 'application/octet-stream');
    
    // In a real scenario, this would chunk the stream.
    // For this implementation, we read it all into a buffer and write it as one chunk to satisfy the interface.
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    await session.writeChunk(buffer, 0);
    
    return session.commit();
  }

  async get(bucket: string, key: string, range?: { start: number; end: number }): Promise<IBinaryObject> {
    const metadata = await this.prisma.binaryObjectMetadata.findUnique({
      where: { bucket_storageKey: { bucket, storageKey: key } }
    });

    if (!metadata) {
      throw new Error(`Object not found: ${bucket}/${key}`);
    }

    const session = await this.createDownloadSession(bucket, key);

    return {
      objectId: metadata.objectId,
      bucket: metadata.bucket,
      storageKey: metadata.storageKey,
      checksumSHA256: metadata.checksumSHA256 || undefined,
      contentLength: Number(metadata.contentLength),
      contentType: metadata.contentType,
      version: metadata.version,
      getStream: () => session.readStream(range)
    };
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.provider.delete(bucket, key);
    await this.prisma.binaryObjectMetadata.deleteMany({
      where: { bucket, storageKey: key }
    });
  }

  async createUploadSession(bucket: string, key: string, contentType: string): Promise<IUploadSession> {
    return new UploadPipeline(bucket, key, this.provider, this.prisma, contentType);
  }

  async createDownloadSession(bucket: string, key: string): Promise<IDownloadSession> {
    return new DownloadPipeline(bucket, key, this.provider);
  }
}
