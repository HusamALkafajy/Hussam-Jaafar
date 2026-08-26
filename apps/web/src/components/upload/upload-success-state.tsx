import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Grid } from '../ui/grid';
import { CheckCircle2, ExternalLink, BrainCircuit, Lightbulb, MessageSquare } from 'lucide-react';
import { ProcessingJob } from '../../mocks/workspace/jobs';

interface UploadSuccessStateProps {
  job: ProcessingJob;
  onOpenReader?: () => void;
}

export function UploadSuccessState({ job, onOpenReader }: UploadSuccessStateProps) {
  return (
    <Card className="p-8 border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center text-center max-w-2xl mx-auto shadow-none">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-50" />
        <div className="relative p-5 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="size-10" />
        </div>
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Processing Complete!</h3>
      <p className="text-muted-foreground mb-8 max-w-md">
        "{job.filename}" has been successfully extracted and indexed. It is now ready for studying.
      </p>
      
      <div className="w-full">
        <Button size="lg" className="w-full sm:w-auto min-w-[200px] mb-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20" onClick={onOpenReader}>
          <ExternalLink className="size-5" />
          Open Reader
        </Button>
      </div>
      
      <div className="w-full pt-8 border-t border-emerald-500/10">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Explore AI Tools</h4>
        <Grid cols={3} gap={4}>
          <Button variant="outline" className="h-auto flex-col gap-3 p-4 opacity-50 cursor-not-allowed border-dashed">
            <div className="p-2 bg-muted rounded-full">
              <BrainCircuit className="size-5 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold whitespace-normal leading-tight">Generate Flashcards</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-3 p-4 opacity-50 cursor-not-allowed border-dashed">
            <div className="p-2 bg-muted rounded-full">
              <Lightbulb className="size-5 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold whitespace-normal leading-tight">Generate Quiz</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-3 p-4 opacity-50 cursor-not-allowed border-dashed">
            <div className="p-2 bg-muted rounded-full">
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold whitespace-normal leading-tight">Ask AI Tutor</span>
          </Button>
        </Grid>
      </div>
    </Card>
  );
}
