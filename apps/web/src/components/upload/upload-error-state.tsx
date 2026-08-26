import React from 'react';
import { MOCK_ERRORS, ErrorType } from '../../mocks/workspace/errors';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { AlertCircle, RefreshCw, X, HelpCircle, FileX } from 'lucide-react';

interface UploadErrorStateProps {
  errorType: ErrorType;
  filename: string;
  onRetry?: () => void;
  onRemove?: () => void;
}

export function UploadErrorState({ errorType, filename, onRetry, onRemove }: UploadErrorStateProps) {
  const error = MOCK_ERRORS[errorType] || MOCK_ERRORS['UNKNOWN'];

  return (
    <Card className="p-6 border-rose-500/20 bg-rose-500/5 flex flex-col items-center text-center max-w-md mx-auto shadow-none">
      <div className="p-4 bg-rose-500/10 text-rose-500 rounded-full mb-4">
        {errorType === 'UNSUPPORTED_FORMAT' ? <FileX className="size-8" /> : <AlertCircle className="size-8" />}
      </div>
      
      <h3 className="text-xl font-bold mb-2">{error.title}</h3>
      <p className="text-sm font-medium text-foreground mb-4 break-all">"{filename}"</p>
      
      <p className="text-muted-foreground mb-2">
        {error.description}
      </p>
      
      <div className="bg-background p-3 rounded-md border text-sm text-muted-foreground w-full mb-6 flex items-start gap-2 text-start">
        <HelpCircle className="size-4 shrink-0 mt-0.5 text-blue-500" />
        <span>{error.suggestion}</span>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
        <Button className="w-full gap-2 bg-rose-500 hover:bg-rose-600 text-white" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Retry Upload
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={onRemove}>
          <X className="size-4" />
          Remove File
        </Button>
      </div>
      
      <Button variant="link" className="mt-4 text-muted-foreground h-auto p-0 text-xs">
        Learn more about supported formats
      </Button>
    </Card>
  );
}
