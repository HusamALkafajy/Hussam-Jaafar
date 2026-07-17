import { ReaderSession } from './reader-session';
import { SelectionState } from './selection-state';
import { ReadingContext } from './reading-context';
import { AIContext } from './ai-context';
import { Citation } from './citations';
import { InteractionEvent } from './interaction-history';
import { AICapability } from './capability-registry';

// Facade for learning modules
export interface LearningContext {
  version: string;
  reader: any; // VirtualReader engine reference placeholder
  selection: SelectionState;
  reading: ReadingContext;
  ai: AIContext;
  session: ReaderSession;
  citations: Record<string, Citation>;
  interactionHistory: InteractionEvent[];
  capabilities: Record<string, AICapability>;
}
