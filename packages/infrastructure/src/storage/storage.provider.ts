export interface IStorageProvider {
  upload(path: string, file: Buffer, mimeType: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}
