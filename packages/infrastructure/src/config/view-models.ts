export interface ConfigurationOverviewView {
  environment: string;
  storageProvider: string;
  queueProvider: string;
  loggerProvider: string;
  metricsProvider: string;
  aiProvider: string;
  isTracingEnabled: boolean;
}

export interface FeatureFlagView {
  flagName: string;
  isEnabled: boolean;
}

export interface ProviderStatusView {
  providerName: string;
  type: 'storage' | 'queue' | 'ai' | 'logger' | 'metrics';
  status: 'active' | 'inactive';
}

export interface EnvironmentSummaryView {
  environment: string;
  isProduction: boolean;
  nodeVersion: string;
}
