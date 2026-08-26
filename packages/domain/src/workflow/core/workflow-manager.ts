import { CommandBus } from '../cqrs/workflow-command-bus';
import { WorkflowCommand } from '../cqrs/workflow-commands';
import { WorkflowExecutor } from './workflow-executor';
import { WorkflowInstance } from './workflow-instance';
import { WorkflowDefinition } from './workflow-definition';

export class WorkflowManager {
  private instances = new Map<string, WorkflowInstance>();
  private definitions = new Map<string, WorkflowDefinition>();

  constructor(
    private commandBus: CommandBus,
    private executor: WorkflowExecutor
  ) {
    // Note: the arrow functions bind 'this' correctly. Wait, wait. CommandBus requires promise returning handlers.
    this.commandBus.subscribe(async (cmd) => this.handleCommand(cmd));
  }

  registerDefinition(definition: WorkflowDefinition) {
    this.definitions.set(definition.id, definition);
  }

  private async handleCommand(command: WorkflowCommand) {
    switch (command.type) {
      case 'StartWorkflowCommand': {
        const def = this.definitions.get(command.definitionId);
        if (!def) throw new Error('Unknown workflow definition');
        
        const instance = new WorkflowInstance(`wf_${Date.now()}`, def, command.payload);
        this.instances.set(instance.id, instance);
        instance.queue();
        this.executor.execute(instance);
        break;
      }
      case 'PauseWorkflowCommand': {
        const instance = this.instances.get(command.workflowId);
        if (instance) instance.pause();
        break;
      }
      case 'CancelWorkflowCommand': {
        const instance = this.instances.get(command.workflowId);
        if (instance) instance.cancel();
        break;
      }
      // Resume, Retry, etc...
    }
  }

  getInstance(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }

  getAllInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values());
  }
}
