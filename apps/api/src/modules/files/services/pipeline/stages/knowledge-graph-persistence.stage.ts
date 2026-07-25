import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage, PipelineContext } from '../pipeline-stage.interface';
import { KnowledgeGraphRepository } from '../../../../knowledge/knowledge-graph.repository';
import { EventBusService } from '../../../../events/event-bus.service';
import { KnowledgeGraphPersistedEvent } from '../../../../events/domain-event';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KnowledgeGraphPersistenceStage implements PipelineStage<any, any> {
  readonly stageName = 'Knowledge Graph Persistence';
  private readonly logger = new Logger(KnowledgeGraphPersistenceStage.name);

  constructor(
    private readonly graphRepository: KnowledgeGraphRepository,
    private readonly eventBus: EventBusService
  ) {}

  async canSkip(context: PipelineContext): Promise<boolean> {
    // If the graph is already persisted (not possible in current design, but we check if we skipped extraction)
    // Wait, the graph generation is in memory. We only skip if graph generation skipped and no graph exists?
    // Actually, we skip if the graph is not present in the context.
    return !context.state.knowledgeGraph;
  }

  async execute(input: any, context: PipelineContext): Promise<any> {
    const { fileId } = input;
    const { knowledgeGraph } = context.state;

    if (!knowledgeGraph) {
      this.logger.warn(`Skipping persistence: No KnowledgeGraph found in context state for file ${fileId}`);
      return input;
    }

    this.logger.log(`Persisting Knowledge Graph for file ${fileId}`);
    
    await this.graphRepository.saveGraph(fileId, knowledgeGraph);

    // Set persistence flag or trigger domain event if required
    context.state.knowledgeGraphPersisted = true;

    this.eventBus.publish(new KnowledgeGraphPersistedEvent(
      uuidv4(),
      fileId,
      { fileId, nodeCount: knowledgeGraph.nodes.length, edgeCount: knowledgeGraph.edges.length }
    ));

    return input; // Pass the input along to the next stage
  }
}
