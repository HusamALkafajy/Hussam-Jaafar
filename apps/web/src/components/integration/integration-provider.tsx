'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { IntegrationGateway } from '@studyai/domain/integration/integration-gateway';
import { ConnectorRegistry } from '@studyai/domain/integration/connector-registry';
import { ConnectorViewModel, SynchronizationViewModel } from '@studyai/domain/integration/integration-view-models';

interface IntegrationContextValue {
  connectors: ConnectorViewModel[];
  synchronizations: SynchronizationViewModel[];
}

const IntegrationContext = createContext<IntegrationContextValue | null>(null);

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => new ConnectorRegistry());
  const [gateway] = useState(() => new IntegrationGateway(registry));
  const [connectors, setConnectors] = useState<ConnectorViewModel[]>([]);
  const [synchronizations, setSynchronizations] = useState<SynchronizationViewModel[]>([]);

  useEffect(() => {
    // Register a mock connector to satisfy plugin requirement visually
    try {
      registry.register({
        id: 'conn_google_drive_v1',
        displayName: 'Google Drive',
        version: '1.0.0',
        provider: 'google',
        supportedCapabilities: ['ImportFiles'],
        authenticationRequirements: { type: 'oauth2' },
        configurationSchema: {},
        supportedWorkflows: [],
        healthCapabilities: ['ping'],
        metadata: {}
      }, () => ({
        authenticate: async () => ({ success: true }),
        executeAction: async () => ({ success: true }),
        checkHealth: async () => ({ success: true, data: { status: 'healthy', latencyMs: 45 } }),
        disconnect: async () => ({ success: true })
      }));
    } catch (e) {
      // Ignore if already registered
    }

    setConnectors([{
      id: 'conn_google_drive_v1',
      displayName: 'Google Drive',
      provider: 'google',
      version: '1.0.0',
      capabilities: ['ImportFiles'],
      state: 'Connected',
      healthStatus: 'healthy'
    }]);

    setSynchronizations([{
      id: 'sync_1',
      connectorName: 'Google Drive',
      status: 'Idle',
      lastSyncAt: new Date().toISOString(),
      mode: 'Manual'
    }]);

  }, [registry]);

  const value = useMemo(() => ({
    connectors,
    synchronizations
  }), [connectors, synchronizations]);

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
}

export function useIntegration() {
  const context = useContext(IntegrationContext);
  if (!context) throw new Error('useIntegration must be used within IntegrationProvider');
  return context;
}
