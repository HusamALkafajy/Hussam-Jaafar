import React from 'react';
import { TimelineStage, MOCK_COMPACT_TIMELINE, MOCK_EXPANDED_TIMELINE } from '../../mocks/workspace/timeline';
import { ProcessingJob } from '../../mocks/workspace/jobs';
import { cn } from '../../lib/utils';
import { CheckCircle2, Circle, Loader2, UploadCloud, List, Cpu, FileJson, ShieldCheck, Database, Zap } from 'lucide-react';

interface ProcessingTimelineProps {
  job: ProcessingJob;
  variant?: 'compact' | 'expanded';
  className?: string;
}

const STAGE_LABELS: Record<TimelineStage, string> = {
  'UPLOADING': 'Uploading',
  'QUEUED': 'Queued',
  'EXTRACTING': 'Extracting Text',
  'BUILDING_AST': 'Building Document Model',
  'VALIDATING': 'Validating Structure',
  'INDEXING': 'Indexing for Search',
  'FINALIZING': 'Finalizing',
  'COMPLETED': 'Ready',
};

const STAGE_ICONS: Record<TimelineStage, React.ElementType> = {
  'UPLOADING': UploadCloud,
  'QUEUED': List,
  'EXTRACTING': Cpu,
  'BUILDING_AST': FileJson,
  'VALIDATING': ShieldCheck,
  'INDEXING': Database,
  'FINALIZING': Zap,
  'COMPLETED': CheckCircle2,
};

export function ProcessingTimeline({ job, variant = 'compact', className }: ProcessingTimelineProps) {
  const stages = variant === 'compact' ? MOCK_COMPACT_TIMELINE : MOCK_EXPANDED_TIMELINE;
  const currentStageIndex = stages.indexOf(job.currentStage);
  
  // If the job is failed, we stop at the current stage
  const isFailed = job.status === 'failed';

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {variant === 'expanded' && <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Processing Timeline</h3>}
      <div className={cn("relative flex", variant === 'compact' ? 'flex-row justify-between items-center' : 'flex-col gap-6')}>
        {/* Timeline connection line for compact view */}
        {variant === 'compact' && (
          <div className="absolute top-4 start-0 end-0 h-0.5 bg-muted -z-10" />
        )}

        {stages.map((stage, index) => {
          const isCompleted = currentStageIndex > index || (job.status === 'completed' && index === stages.length - 1);
          const isCurrent = currentStageIndex === index && !isFailed && job.status !== 'completed';
          const isStageFailed = currentStageIndex === index && isFailed;
          const isPending = currentStageIndex < index;

          const Icon = STAGE_ICONS[stage];

          // For compact view, 'EXTRACTING' represents any processing stage
          let label = STAGE_LABELS[stage];
          if (variant === 'compact' && stage === 'EXTRACTING') {
            label = 'Processing';
            // If the actual stage is anything after QUEUED but before COMPLETED, it falls into this bucket
            if (MOCK_EXPANDED_TIMELINE.indexOf(job.currentStage) > MOCK_EXPANDED_TIMELINE.indexOf('QUEUED') && 
                MOCK_EXPANDED_TIMELINE.indexOf(job.currentStage) < MOCK_EXPANDED_TIMELINE.indexOf('COMPLETED')) {
               // Update logic if needed for compact active state
            }
          }

          const iconColor = isStageFailed ? 'text-rose-500' 
                          : isCurrent ? 'text-primary' 
                          : isCompleted ? 'text-emerald-500' 
                          : 'text-muted-foreground/30';
          
          const bgColor = isStageFailed ? 'bg-rose-500/10' 
                        : isCurrent ? 'bg-primary/10' 
                        : isCompleted ? 'bg-emerald-500/10' 
                        : 'bg-muted';

          return (
            <div 
              key={stage} 
              className={cn(
                "relative flex", 
                variant === 'compact' ? 'flex-col items-center gap-2 flex-1' : 'flex-row items-start gap-4'
              )}
            >
              {/* Timeline connection line for expanded view */}
              {variant === 'expanded' && index !== stages.length - 1 && (
                <div className={cn(
                  "absolute top-8 start-4 bottom-[-16px] w-0.5 -translate-x-1/2",
                  isCompleted ? "bg-emerald-500" : "bg-muted"
                )} />
              )}
              
              <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0 z-10", bgColor, iconColor)}>
                {isCompleted ? (
                  <CheckCircle2 className="size-5" />
                ) : isCurrent ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isStageFailed ? (
                  <Icon className="size-4" />
                ) : (
                  <Circle className="size-4 opacity-50" />
                )}
              </div>
              
              <div className={cn("flex flex-col", variant === 'compact' ? 'items-center text-center' : '')}>
                <span className={cn(
                  "text-sm font-medium",
                  isStageFailed ? "text-rose-500" : isCurrent ? "text-primary font-semibold" : isCompleted ? "text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                </span>
                {variant === 'expanded' && (
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {isCompleted ? 'Done' : isStageFailed ? 'Failed' : isCurrent ? 'In progress...' : 'Pending'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
