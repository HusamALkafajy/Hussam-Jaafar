import { WorkflowCommand } from './workflow-commands';

export interface CommandBus {
  dispatch(command: WorkflowCommand): Promise<void>;
  subscribe(handler: (cmd: WorkflowCommand) => Promise<void>): void;
}

// Simple in-memory command bus abstraction
export class WorkflowCommandBus implements CommandBus {
  private handlers: ((cmd: WorkflowCommand) => Promise<void>)[] = [];

  subscribe(handler: (cmd: WorkflowCommand) => Promise<void>) {
    this.handlers.push(handler);
  }

  async dispatch(command: WorkflowCommand): Promise<void> {
    for (const handler of this.handlers) {
      await handler(command);
    }
  }
}
