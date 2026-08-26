'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ReaderStateProvider } from '../../../../components/reader/reader-state';
import { ReaderLayout } from '../../../../components/reader/reader-layout';
import { ReaderContainer } from '../../../../components/reader/reader-container';
import { LearningPlatformProvider } from '../../../../components/learning/learning-platform-provider';

export default function ReaderPage() {
  const params = useParams();
  const documentId = params.documentId as string;

  return (
    <ReaderStateProvider documentId={documentId}>
      <LearningPlatformProvider documentId={documentId}>
        <ReaderLayout>
          <ReaderContainer />
        </ReaderLayout>
      </LearningPlatformProvider>
    </ReaderStateProvider>
  );
}
