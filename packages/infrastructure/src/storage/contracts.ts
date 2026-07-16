import { Readable, Writable } from 'stream';

export interface IBinaryReference {
  objectId: string;
  bucket: string;
  storageKey: string;
  checksumSHA256?: string;
  contentLength: number;
  contentType: string;
  version: number;
}

export interface IBinaryObject extends IBinaryReference {
  getStream(): Promise<Readable>;
}

export interface IStorageProvider {
  upload(bucket: string, key: string, stream: Readable, options?: { contentType?: string, contentLength?: number }): Promise<void>;
  download(bucket: string, key: string, range?: { start: number, end: number }): Promise<Readable>;
  delete(bucket: string, key: string): Promise<void>;
  exists(bucket: string, key: string): Promise<boolean>;
  getSize(bucket: string, key: string): Promise<number>;
}

export interface IUploadSession {
  sessionId: string;
  bucket: string;
  storageKey: string;
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  writeChunk(chunk: Buffer, offset: number): Promise<void>;
  commit(): Promise<IBinaryReference>;
  abort(): Promise<void>;
}

export interface IDownloadSession {
  sessionId: string;
  bucket: string;
  storageKey: string;
  readStream(range?: { start: number, end: number }): Promise<Readable>;
}

export interface ISignedUrlProvider {
  generateUploadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string>;
  generateDownloadUrl(bucket: string, key: string, expiresInSeconds: number): Promise<string>;
}

export interface IObjectStorage {
  put(bucket: string, key: string, stream: Readable, options?: { contentType?: string, contentLength?: number }): Promise<IBinaryReference>;
  get(bucket: string, key: string, range?: { start: number, end: number }): Promise<IBinaryObject>;
  delete(bucket: string, key: string): Promise<void>;
  createUploadSession(bucket: string, key: string, contentType: string): Promise<IUploadSession>;
  createDownloadSession(bucket: string, key: string): Promise<IDownloadSession>;
}
