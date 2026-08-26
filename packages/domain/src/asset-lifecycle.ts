export type AssetLifecycleStatus = 'Draft' | 'Generated' | 'Reviewed' | 'Approved' | 'Archived';

export interface AssetLifecycle {
  readonly status: AssetLifecycleStatus;
  readonly updatedAt: string;
}
