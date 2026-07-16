import { ConnectorCapability } from './capability-contracts';

export interface IntegrationManifest {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly provider: string;
  readonly supportedCapabilities: ConnectorCapability[];
  readonly authenticationRequirements: any;
  readonly configurationSchema: any;
  readonly supportedWorkflows: string[];
  readonly healthCapabilities: string[];
  readonly metadata: Record<string, string>;
}
