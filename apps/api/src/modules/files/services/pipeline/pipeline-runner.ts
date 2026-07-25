import { Injectable, Logger } from '@nestjs/common';
import { PipelineContext, PipelineStage } from './pipeline-stage.interface';

@Injectable()
export class PipelineRunner {
  private readonly logger = new Logger(PipelineRunner.name);
  private stages: PipelineStage[] = [];

  registerStages(stages: PipelineStage[]): void {
    this.stages = stages;
  }

  async execute(initialInput: any, context: PipelineContext): Promise<any> {
    let currentInput = initialInput;

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      context.log('info', `Evaluating stage: ${stage.stageName}`);

      const skip = await stage.canSkip(context);
      if (skip) {
        context.log('info', `Skipping stage: ${stage.stageName}`);
        continue;
      }

      try {
        context.log('info', `Executing stage: ${stage.stageName}`);
        await context.reportProgress(stage.stageName, 0);

        currentInput = await stage.execute(currentInput, context);
        
        await context.reportProgress(stage.stageName, 100);
        context.log('info', `Completed stage: ${stage.stageName}`);
      } catch (error: any) {
        context.log('error', `Stage failed: ${stage.stageName}`, error);

        // Attempt rollback of current and previous stages (in reverse)
        for (let j = i; j >= 0; j--) {
          const rollbackStage = this.stages[j];
          if (rollbackStage.rollback) {
            try {
              context.log('info', `Rolling back stage: ${rollbackStage.stageName}`);
              await rollbackStage.rollback(context);
            } catch (rollbackError: any) {
              context.log('error', `Rollback failed for stage: ${rollbackStage.stageName}`, rollbackError);
            }
          }
        }

        throw error;
      }
    }

    return currentInput;
  }
}
