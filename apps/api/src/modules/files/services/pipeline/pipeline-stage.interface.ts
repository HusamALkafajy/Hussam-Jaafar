export interface PipelineContext {
  attemptId: string;
  fileId: string;
  userId?: string;
  documentId?: string;
  signal?: AbortSignal;
  state: Record<string, any>;
  reportProgress(stage: string, progress: number): Promise<void>;
  log(level: 'info' | 'warn' | 'error', message: string, meta?: any): void;
}

export interface PipelineStage<TInput = any, TOutput = any> {
  readonly stageName: string;

  canSkip(context: PipelineContext): Promise<boolean>;
  execute(input: TInput, context: PipelineContext): Promise<TOutput>;
  retry?(input: TInput, context: PipelineContext, attempt: number): Promise<TOutput>;
  rollback?(context: PipelineContext): Promise<void>;
}
