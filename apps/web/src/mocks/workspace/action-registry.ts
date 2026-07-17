import { AICapability } from './capability-registry';

export interface AIAction {
  capabilityId: string;
  payload?: any;
  contextOverride?: any;
}

export const executeAction = async (action: AIAction, capability: AICapability) => {
  console.log(`Executing action: ${action.capabilityId}`, action.payload);
  return capability.execute(action.payload);
};
