'use client';

import { MOCK_CAPABILITY_REGISTRY, AICapability } from '../../mocks/workspace/capability-registry';

class CapabilityRegistry {
  private capabilities: Map<string, AICapability> = new Map();

  constructor() {
    // Load default capabilities
    Object.values(MOCK_CAPABILITY_REGISTRY).forEach(cap => this.register(cap));
  }

  register(capability: AICapability) {
    this.capabilities.set(capability.id, capability);
  }

  get(id: string): AICapability | undefined {
    return this.capabilities.get(id);
  }

  getAll(): AICapability[] {
    return Array.from(this.capabilities.values());
  }

  getAvailable(contextParams: { hasSelection: boolean, currentNode: string | null }): AICapability[] {
    return this.getAll().filter(cap => {
      if (cap.availability === 'future') return false;
      if (cap.availability === 'selection' && !contextParams.hasSelection) return false;
      if (cap.requiredContext.includes('currentNode') && !contextParams.currentNode) return false;
      return true;
    });
  }
}

export const capabilityRegistry = new CapabilityRegistry();
