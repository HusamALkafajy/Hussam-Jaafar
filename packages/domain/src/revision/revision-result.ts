export interface RevisionResult {
  readonly sessionId: string;
  readonly completionRate: number;
  readonly accuracy: number;
  readonly reviewDurationSeconds: number;
  readonly reviewedAssetIds: string[];
  readonly generatedAt: string;
}
