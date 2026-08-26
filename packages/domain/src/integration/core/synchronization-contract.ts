export type SyncMode = 'Manual' | 'Scheduled' | 'Incremental' | 'Full' | 'Bidirectional' | 'RealTime';

export interface SynchronizationContract {
  readonly syncId: string;
  readonly mode: SyncMode;
  readonly targetConnectorId: string;
  readonly scheduleCron?: string; // e.g. "0 0 * * *"
  readonly lastSyncAt?: string;
  readonly status: 'Idle' | 'Syncing' | 'Failed';
}
