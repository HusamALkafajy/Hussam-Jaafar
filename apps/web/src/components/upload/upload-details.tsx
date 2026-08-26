import React from 'react';
import { ProcessingJob } from '../../mocks/workspace/jobs';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Grid } from '../ui/grid';
import { FileText, Clock, Calendar, FileType, Image as ImageIcon, FileAudio, ExternalLink, RefreshCw } from 'lucide-react';
import { useLocale } from '../../hooks/use-locale';
import { formatDate } from '../../lib/utils';
import { ProcessingTimeline } from './processing-timeline';
import { ProcessingLog } from './processing-log';

interface UploadDetailsProps {
  job: ProcessingJob;
  onClose?: () => void;
  onRetry?: (jobId: string) => void;
}

export function UploadDetails({ job, onClose, onRetry }: UploadDetailsProps) {
  const { locale } = useLocale();

  const getFileIcon = () => {
    if (job.filename.match(/\.(mp3|mp4|wav)$/i)) return <FileAudio className="size-12 text-amber-500" />;
    if (job.filename.match(/\.(jpg|png|svg)$/i)) return <ImageIcon className="size-12 text-emerald-500" />;
    return <FileText className="size-12 text-indigo-500" />;
  };

  const isFailed = job.status === 'failed';
  const isCompleted = job.status === 'completed';

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-start gap-4">
        <div className="p-4 rounded-xl bg-muted/20 border shrink-0">
          {getFileIcon()}
        </div>
        <div className="flex flex-col flex-1 min-w-0 pt-1">
          <h2 className="text-xl font-bold line-clamp-2 leading-tight mb-2">{job.filename}</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant={
              isCompleted ? 'default' : 
              isFailed ? 'destructive' : 'secondary'
            } className="uppercase">
              {job.status}
            </Badge>
            {job.language && <Badge variant="outline">{job.language}</Badge>}
          </div>
        </div>
      </div>

      <Grid cols={2} gap={4}>
        <Card className="p-4 flex items-center gap-3 bg-muted/20 border-transparent shadow-none">
          <FileType className="size-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Size</span>
            <span className="text-sm font-medium">{(job.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        </Card>
        {job.pageCount && (
          <Card className="p-4 flex items-center gap-3 bg-muted/20 border-transparent shadow-none">
            <FileText className="size-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pages</span>
              <span className="text-sm font-medium">{job.pageCount}</span>
            </div>
          </Card>
        )}
        <Card className="p-4 flex items-center gap-3 bg-muted/20 border-transparent shadow-none">
          <Calendar className="size-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Uploaded</span>
            <span className="text-sm font-medium">{formatDate(job.createdAt, locale)}</span>
          </div>
        </Card>
        {job.estimatedRemainingTimeSeconds !== undefined && job.status === 'processing' && (
          <Card className="p-4 flex items-center gap-3 bg-primary/5 border-primary/20 shadow-none">
            <Clock className="size-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs text-primary/80 uppercase tracking-wider font-semibold">Est. Remaining</span>
              <span className="text-sm font-medium text-primary">~{job.estimatedRemainingTimeSeconds} seconds</span>
            </div>
          </Card>
        )}
      </Grid>

      <div className="h-px bg-border my-2" />

      <ProcessingTimeline job={job} variant="expanded" />

      <ProcessingLog jobId={job.id} />

      <div className="mt-auto pt-6 flex flex-col gap-3">
        {isCompleted && (
          <Button className="w-full gap-2" size="lg">
            <ExternalLink className="size-4" />
            Open in Reader
          </Button>
        )}
        {isFailed && onRetry && (
          <Button className="w-full gap-2" variant="outline" onClick={() => onRetry(job.id)}>
            <RefreshCw className="size-4" />
            Retry Processing
          </Button>
        )}
        {onClose && (
           <Button variant="ghost" onClick={onClose} className="w-full">
             Close Details
           </Button>
        )}
      </div>
    </div>
  );
}
