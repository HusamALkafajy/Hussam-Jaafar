import { IntegrationManifest } from './core/integration-manifest';
import { ConnectorAdapter } from './core/connector-adapter';
import { ConnectorCapability } from './core/capability-contracts';

export interface RegisteredConnector {
  manifest: IntegrationManifest;
  adapterFactory: () => ConnectorAdapter;
}

export class ConnectorRegistry {
  private connectors = new Map<string, RegisteredConnector>();

  register(manifest: IntegrationManifest, adapterFactory: () => ConnectorAdapter) {
    if (this.connectors.has(manifest.id)) {
      throw new Error(`Connector with ID ${manifest.id} is already registered.`);
    }
    this.connectors.set(manifest.id, { manifest, adapterFactory });
  }

  getManifest(id: string): IntegrationManifest | undefined {
    return this.connectors.get(id)?.manifest;
  }

  createAdapter(id: string): ConnectorAdapter {
    const connector = this.connectors.get(id);
    if (!connector) throw new Error(`Unknown connector ID: ${id}`);
    return connector.adapterFactory();
  }

  findByCapability(capability: ConnectorCapability): IntegrationManifest[] {
    return Array.from(this.connectors.values())
      .map(c => c.manifest)
      .filter(m => m.supportedCapabilities.includes(capability));
  }
  
  getAllManifests(): IntegrationManifest[] {
    return Array.from(this.connectors.values()).map(c => c.manifest);
  }
}
