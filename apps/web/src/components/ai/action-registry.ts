'use client';

import { capabilityRegistry } from './capability-registry';
import { internalEvents } from '../learning/events';
import { AIAction } from '../../mocks/workspace/action-registry';

class ActionRegistry {
  async dispatch(action: AIAction): Promise<void> {
    const capability = capabilityRegistry.get(action.capabilityId);
    if (!capability) {
      console.error(`Capability ${action.capabilityId} not found`);
      return;
    }

    // Publish internal event
    internalEvents.publish('action.executed', action);

    try {
      await capability.execute(action.payload);
      // Event: action.completed (placeholder)
    } catch (error) {
      console.error(`Error executing action ${action.capabilityId}:`, error);
      // Event: action.failed
    }
  }
}

export const actionRegistry = new ActionRegistry();
