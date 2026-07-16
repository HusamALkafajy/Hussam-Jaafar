import { ConnectorRegistry } from './connector-registry';
import { ConnectorAdapter, ConnectorResult } from './core/connector-adapter';
import { IntegrationManifest } from './core/integration-manifest';

export class IntegrationGateway {
  constructor(private registry: ConnectorRegistry) {}

  // The Gateway orchestrates connection by resolving via the Registry
  async connect(connectorId: string, credentials: any): Promise<ConnectorResult<void>> {
    const adapter = this.registry.createAdapter(connectorId);
    
    // In a full implementation, apply RateLimitPolicy, RetryPolicy, etc. here before executing
    
    return await adapter.authenticate(credentials);
  }

  async executeAction(connectorId: string, action: string, payload: any): Promise<ConnectorResult<any>> {
    const adapter = this.registry.createAdapter(connectorId);
    return await adapter.executeAction(action, payload);
  }

  async checkHealth(connectorId: string) {
    const adapter = this.registry.createAdapter(connectorId);
    return await adapter.checkHealth();
  }

  // Get manifest for UI consumption without exposing adapters
  getManifest(connectorId: string): IntegrationManifest | undefined {
    return this.registry.getManifest(connectorId);
  }

  getAllManifests(): IntegrationManifest[] {
    return this.registry.getAllManifests();
  }
}
