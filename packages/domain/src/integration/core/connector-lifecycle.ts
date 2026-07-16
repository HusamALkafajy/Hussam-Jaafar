export type ConnectorState = 
  | 'Registered'
  | 'Configured'
  | 'Authorized'
  | 'Connected'
  | 'Disconnected'
  | 'Suspended'
  | 'Deprecated'
  | 'Removed';

export class ConnectorLifecycle {
  private _state: ConnectorState = 'Registered';

  get state() { return this._state; }

  transitionTo(newState: ConnectorState) {
    // A robust state machine would validate allowed transitions here
    // e.g. Registered -> Configured -> Authorized -> Connected
    this._state = newState;
  }
}
