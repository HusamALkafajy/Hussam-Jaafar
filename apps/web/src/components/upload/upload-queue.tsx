import React from 'react';
import { MOCK_JOBS, ProcessingJob } from '../../mocks/workspace/jobs';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Stack } from '../ui/stack';
import { CheckCircle2, AlertCircle, Loader2, Play, FileText, ChevronRight } from 'lucide-react';
import { useLocale } from '../../hooks/use-locale';
import { formatDate } from '../../lib/utils';
import Link from 'next/link';

interface UploadQueueProps {
  variant?: 'compact' | 'full';
  onSelectJob?: (job: ProcessingJob) => void;
}

export function UploadQueue({ variant = 'full', onSelectJob }: UploadQueueProps) {
  const { locale } = useLocale();

  // For compact view, we just show top 5 active/recent
  const displayJobs = variant === 'compact' 
    ? [...MOCK_JOBS].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5)
    : MOCK_JOBS;

  return (
    <Stack gap={4}>
      {variant === 'compact' && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">Recent Processing Jobs</h3>
          <Button
            nativeButton={false}
            render={<Link href="/upload" />}
            variant="link"
            className="text-primary p-0 h-auto"
          >
            View All Queue
          </Button>
        </div>
      )}

      {variant === 'full' && (
        <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg border mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Queue Filters:</span>
            <Badge variant="secondary">All ({MOCK_JOBS.length})</Badge>
            <Badge variant="outline">Processing</Badge>
            <Badge variant="outline">Completed</Badge>
            <Badge variant="outline">Failed</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Sort by: <span className="font-medium text-foreground cursor-pointer">Date Added</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {displayJobs.map(job => {
          const isProcessing = job.status === 'processing' || job.status === 'queued';
          const isFailed = job.status === 'failed';
          const isCompleted = job.status === 'completed';

          return (
            <Card 
              key={job.id} 
              className="p-4 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => onSelectJob?.(job)}
            >
              <div className={`p-2.5 rounded-lg shrink-0 transition-transform group-hover:scale-110 ${
                isCompleted ? 'bg-emerald-500/10 text-emerald-500' :
                isProcessing ? 'bg-indigo-500/10 text-indigo-500' :
                'bg-rose-500/10 text-rose-500'
              }`}>
                {isCompleted ? <CheckCircle2 className="size-5" /> :
                 job.status === 'processing' ? <Loader2 className="size-5 animate-spin" /> :
                 job.status === 'queued' ? <Play className="size-5" /> :
                 <AlertCircle className="size-5" />}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <h4 className="font-semibold line-clamp-1">{job.filename}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{(job.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                  <span>•</span>
                  <span>{formatDate(job.updatedAt, locale)}</span>
                  {isProcessing && (
                     <>
                       <span>•</span>
                       <span className="text-indigo-500 font-medium">
                         {job.currentStage.replace('_', ' ')}
                       </span>
                     </>
                  )}
                </div>
                {/* Progress bar for processing states */}
                {isProcessing && (
                  <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {variant === 'full' && (
                <div className="hidden md:flex shrink-0">
                  <Badge variant={isCompleted ? 'default' : isFailed ? 'destructive' : 'secondary'} className="uppercase">
                    {job.status}
                  </Badge>
                </div>
              )}

              <ChevronRight className="size-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity rtl:-scale-x-100" />
            </Card>
          );
        })}

        {displayJobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/10">
            <div className="p-3 bg-muted text-muted-foreground rounded-full mb-3">
              <FileText className="size-6" />
            </div>
            <h3 className="font-semibold mb-1">Queue is empty</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your processing queue is currently empty. Upload documents to see them here.
            </p>
          </div>
        )}
      </div>
    </Stack>
  );
}
