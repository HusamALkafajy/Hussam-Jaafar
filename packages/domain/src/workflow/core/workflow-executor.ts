import { WorkflowInstance } from './workflow-instance';
import { JobQueue } from '../job/job-queue';
import { JobInstance } from '../job/job-instance';

export class WorkflowExecutor {
  constructor(private jobQueue: JobQueue) {}

  execute(workflow: WorkflowInstance) {
    if (workflow.status !== 'Queued') return;
    
    workflow.start();

    // The executor doesn't care what the job is, it just queues it up.
    // In a real system, the executor would map the current step to a job and queue it.
    const stepId = workflow.currentStepId;
    if (stepId) {
      const stepDef = workflow.definition.steps[stepId];
      if (stepDef) {
        const job = new JobInstance(
          `job_${Date.now()}`,
          workflow.id,
          stepDef.jobDefinition,
          // Pass any context down
        );
        this.jobQueue.enqueue(job);
      } else {
        // Step not found, fail workflow
        workflow.complete({ success: false, errorPayload: 'Step not found' });
      }
    } else {
      workflow.complete({ success: true });
    }
  }

  // Handle job completion and advance workflow
  handleJobCompletion(workflow: WorkflowInstance, job: JobInstance) {
    if (workflow.status !== 'Running') return;

    if (job.result && job.result.success) {
      const currentStepDef = workflow.definition.steps[workflow.currentStepId!];
      if (currentStepDef && currentStepDef.nextStepIds.length > 0) {
        // Advance to next step (for simplicity, just taking the first one in this linear example)
        workflow.advanceStep(currentStepDef.nextStepIds[0]);
        this.execute(workflow); // Queue the next job
      } else {
        workflow.complete({ success: true, outputPayload: job.result.outputPayload });
      }
    } else {
      // Failure policy would be evaluated here
      workflow.complete({ success: false, errorPayload: job.result?.errorPayload });
    }
  }
}
