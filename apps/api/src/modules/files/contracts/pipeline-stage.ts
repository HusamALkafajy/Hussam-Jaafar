export interface PipelineStage<TInput = any, TOutput = any> {
  readonly stageName: string;
  
  /**
   * Executes the pipeline stage.
   */
  execute(input: TInput, context?: any): Promise<TOutput>;

  /**
   * Evaluates if this stage can be skipped.
   */
  canSkip?(input: TInput, context?: any): Promise<boolean>;

  /**
   * Handles retry logic.
   */
  retry?(input: TInput, context?: any, attempt?: number): Promise<TOutput>;

  /**
   * Rollback logic if the pipeline fails downstream.
   */
  rollback?(input: TInput, context?: any): Promise<void>;
}
