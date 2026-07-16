import { IDownloadSession, IStorageProvider } from '../contracts';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

export class DownloadPipeline implements IDownloadSession {
  public readonly sessionId: string;
  
  constructor(
    public readonly bucket: string,
    public readonly storageKey: string,
    private readonly provider: IStorageProvider
  ) {
    this.sessionId = randomUUID();
  }

  async readStream(range?: { start: number; end: number }): Promise<Readable> {
    return this.provider.download(this.bucket, this.storageKey, range);
  }
}
