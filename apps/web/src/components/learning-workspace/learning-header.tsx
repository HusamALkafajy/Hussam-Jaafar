import React from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, Settings, Share } from 'lucide-react';
import Link from 'next/link';

export function LearningHeader({ documentId }: { documentId: string }) {
  return (
    <header className="flex h-14 items-center justify-between px-4 border-b bg-background shrink-0">
      <div className="flex items-center gap-4">
        <Link href={`/read/${documentId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="font-semibold text-sm">Learning Workspace</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Share className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
