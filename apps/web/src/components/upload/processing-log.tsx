import React from 'react';
import { MOCK_LOGS } from '../../mocks/workspace/logs';
import { cn, formatDate } from '../../lib/utils';
import { useLocale } from '../../hooks/use-locale';
import { Terminal } from 'lucide-react';

interface ProcessingLogProps {
  jobId: string;
  className?: string;
}

export function ProcessingLog({ jobId, className }: ProcessingLogProps) {
  const { locale } = useLocale();
  const logs = MOCK_LOGS[jobId] || [];

  return (
    <div className={cn("flex flex-col border rounded-lg overflow-hidden bg-muted/20", className)}>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Terminal className="size-4" />
        Processing Log
      </div>
      <div className="p-4 flex flex-col gap-2 max-h-64 overflow-y-auto font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">No logs available for this job.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex flex-row items-start gap-3 hover:bg-muted/30 px-2 py-1 rounded">
              <span className="text-muted-foreground shrink-0 w-20 text-xs mt-0.5">
                {new Date(log.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={cn(
                "flex-1",
                log.level === 'error' ? 'text-rose-500' :
                log.level === 'warn' ? 'text-amber-500' :
                'text-foreground'
              )}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
