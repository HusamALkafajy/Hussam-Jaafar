export interface LearningContextInterface {
  readonly documentId: string;
  readonly documentTitle: string;
  
  // A generic way to identify the current structural location
  readonly location: {
    readonly chapter?: string | null;
    readonly section?: string | null;
    readonly heading?: string | null;
    readonly hierarchy: string[];
    readonly nodeId: string;
  };
  
  // Selection or focus area
  readonly focus: {
    readonly text: string | null;
    readonly offsets?: { start: number; end: number } | null;
  };
  
  // Surrounding context
  readonly bounds: {
    readonly startNodeId: string | null;
    readonly endNodeId: string | null;
    readonly visibleWindow: string[];
  };
}
