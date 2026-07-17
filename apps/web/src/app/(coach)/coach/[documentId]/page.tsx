import React from 'react';
import { StudyCoachProvider } from '../../../../components/study-coach/study-coach-provider';
import { CoachHome } from '../../../../components/study-coach/coach-home';

export default async function CoachPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return (
    <StudyCoachProvider documentId={documentId}>
      <CoachHome />
    </StudyCoachProvider>
  );
}
