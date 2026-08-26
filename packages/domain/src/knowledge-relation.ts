export type RelationType = 
  | 'Prerequisite'
  | 'RelatedTo'
  | 'ContrastsWith'
  | 'ElaboratesOn'
  | 'DependsOn';

export interface KnowledgeRelation {
  readonly id: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly relationType: RelationType;
  readonly confidence: number;
}
