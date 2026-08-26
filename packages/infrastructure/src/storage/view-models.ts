export interface ObjectMetadataView {
  objectId: string;
  bucket: string;
  storageKey: string;
  checksumSHA256: string | null;
  contentLength: number;
  contentType: string;
  version: number;
  uploadStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageUsageView {
  totalObjects: number;
  totalBytes: number;
  bucketUsage: Record<string, { objects: number, bytes: number }>;
}

export interface UploadSessionView {
  sessionId: string;
  bucket: string;
  storageKey: string;
  status: string;
}
