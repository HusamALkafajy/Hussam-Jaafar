import { IntegrationManifest } from './core/integration-manifest';
import { ConnectorState } from './core/connector-lifecycle';
import { ConnectorEvent } from './core/connector-events';

export interface ConnectorViewModel {
  readonly id: string;
  readonly displayName: string;
  readonly provider: string;
  readonly version: string;
  readonly capabilities: string[];
  readonly state: ConnectorState;
  readonly healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
}

export interface SynchronizationViewModel {
  readonly id: string;
  readonly connectorName: string;
  readonly status: 'Idle' | 'Syncing' | 'Failed';
  readonly lastSyncAt?: string;
  readonly mode: string;
}
