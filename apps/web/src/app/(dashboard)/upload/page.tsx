'use client';

import React, { useState } from 'react';
import { MOCK_ACTIVE_PROCESSING } from '../../../mocks/workspace/processing';
import { ProcessingJob } from '../../../mocks/workspace/jobs';
import { Container } from '../../../components/ui/container';
import { Stack } from '../../../components/ui/stack';
import { Grid } from '../../../components/ui/grid';
import { Card } from '../../../components/ui/card';
import { FilePicker } from '../../../components/ui/file-picker';
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from '../../../components/ui/page-header';
import { UploadQueue } from '../../../components/upload/upload-queue';
import { UploadDetails } from '../../../components/upload/upload-details';
import { UploadSuccessState } from '../../../components/upload/upload-success-state';
import { UploadErrorState } from '../../../components/upload/upload-error-state';
import { FileText, FileAudio, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useLocale } from '../../../hooks/use-locale';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const { locale } = useLocale();
  const router = useRouter();
  
  // State to track if the user has selected a specific job from the queue to view details
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null);

  // Demo state: if active processing exists and user hasn't selected another job, show active
  // In a real app, this might be managed by a global context or URL param
  const displayJob = selectedJob || null;

  // FTUE Integration: Redirect directly to the reader for the first upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // In a real app, this would dispatch to the backend
    console.log("Mock upload initiated:", e.target.files);
    
    // Auto-redirect to the reader for the FTUE
    router.push('/read/doc-new-123');
  };

  const handleOpenReader = () => {
    // This is a placeholder for the future Reader implementation
    alert("Opening Virtual Reader... (Coming soon in Epic 3)");
  };

  return (
    <Container size="xl" className="py-8 h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader className="pb-6 border-0 shrink-0">
        <PageHeaderHeading>Upload Center</PageHeaderHeading>
        <PageHeaderDescription>Add documents and media to your workspace. The AI engine will extract and prepare them for study.</PageHeaderDescription>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-8 min-h-0 flex-1">
        {/* Left Column: Upload Center & Queue */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-2 gap-8">
          
          <Stack gap={4}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">New Upload</h3>
            <Card className="p-1">
              <div className="p-6 md:p-10 border-2 border-dashed rounded-xl bg-muted/10 flex flex-col items-center justify-center text-center gap-6">
                <FilePicker 
                  className="py-12 px-6 w-full max-w-lg bg-background border-primary/20 hover:border-primary/50 transition-colors shadow-sm"
                  onChange={handleUpload}
                />
                
                <div className="flex flex-col items-center text-muted-foreground text-sm max-w-sm mt-2">
                  <p className="mb-4">Maximum file size: 100MB per document.</p>
                  <Grid cols={3} gap={4} className="w-full">
                    <div className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-muted transition-colors">
                      <FileText className="size-5 text-indigo-500" />
                      <span className="text-xs font-medium">PDF, DOCX</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-muted transition-colors">
                      <ImageIcon className="size-5 text-emerald-500" />
                      <span className="text-xs font-medium">JPG, PNG</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-muted transition-colors">
                      <FileAudio className="size-5 text-amber-500" />
                      <span className="text-xs font-medium">MP3, MP4</span>
                    </div>
                  </Grid>
                </div>
              </div>
            </Card>
          </Stack>

          <Stack gap={4}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Processing Queue</h3>
            <UploadQueue 
              variant="full" 
              onSelectJob={(job) => setSelectedJob(job)} 
            />
          </Stack>

        </div>

        {/* Right Column: Processing Details / Status */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 shrink-0">Processing Details</h3>
          <Card className="p-6 flex flex-col flex-1 overflow-y-auto">
            {displayJob ? (
              displayJob.status === 'completed' ? (
                <div className="my-auto">
                  <UploadSuccessState job={displayJob} onOpenReader={handleOpenReader} />
                  <div className="mt-8 text-center">
                    <button onClick={() => setSelectedJob(null)} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                      Close Details
                    </button>
                  </div>
                </div>
              ) : displayJob.status === 'failed' ? (
                <div className="my-auto">
                  <UploadErrorState 
                    errorType={displayJob.errorType || 'UNKNOWN'} 
                    filename={displayJob.filename}
                    onRetry={() => alert("Retrying...")}
                    onRemove={() => setSelectedJob(null)}
                  />
                  <div className="mt-8 text-center">
                    <button onClick={() => setSelectedJob(null)} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                      Close Details
                    </button>
                  </div>
                </div>
              ) : (
                <UploadDetails 
                  job={displayJob} 
                  onClose={() => setSelectedJob(null)} 
                  onRetry={(id) => alert(`Retrying job ${id}`)}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <AlertCircle className="size-12 mb-4 opacity-20" />
                <h4 className="text-lg font-semibold text-foreground mb-2">No Job Selected</h4>
                <p className="text-sm max-w-[250px]">
                  Select a document from the queue to view its processing timeline, detailed logs, or error reports.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Container>
  );
}
