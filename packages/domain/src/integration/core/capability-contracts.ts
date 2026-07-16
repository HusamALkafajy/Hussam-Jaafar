export type ConnectorCapability = 
  | 'ImportFiles'
  | 'ExportFiles'
  | 'Synchronization'
  | 'Authentication'
  | 'Notifications'
  | 'Calendar'
  | 'Messaging'
  | 'Search'
  | 'Metadata'
  | 'Streaming';

export interface CapabilityContract {
  readonly capability: ConnectorCapability;
  readonly requiredPermissions: string[];
}
