import { KnowledgeGraph } from '../../knowledge/contracts/knowledge-graph';
import { AssetType, LearningAsset } from './learning-asset';

export interface AssetGenerator<TPayload = any> {
  readonly assetType: AssetType;

  /**
   * Generates specialized payloads given a canonical Knowledge Graph.
   */
  generatePayloads(graph: KnowledgeGraph, context?: any): TPayload[] | Promise<TPayload[]>;

  /**
   * Validates the generated payload.
   */
  validatePayload(payload: TPayload): boolean;

  /**
   * Converts the payload into the canonical LearningAsset envelope.
   */
  mapToAsset(payload: TPayload, graph: KnowledgeGraph): LearningAsset<TPayload>;

  /**
   * Persists the generated assets to the database.
   */
  persist(assets: LearningAsset<TPayload>[], context: any): Promise<void>;
}
