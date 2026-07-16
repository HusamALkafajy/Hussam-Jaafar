export type ConnectorEventType = 
  | 'connector.registered'
  | 'connector.connected'
  | 'connector.authorized'
  | 'connector.disconnected'
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'health.changed'
  | 'configuration.updated';

export interface ConnectorEvent {
  readonly id: string;
  readonly connectorId: string;
  readonly type: ConnectorEventType;
  readonly timestamp: string;
  readonly payload?: any;
}
