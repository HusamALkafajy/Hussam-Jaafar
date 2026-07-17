'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { LearningWorkspaceProvider, useLearningWorkspace } from '../../../../components/learning-workspace/learning-workspace-provider';
import { LearningWorkspaceLayout } from '../../../../components/learning-workspace/learning-workspace-layout';
import { LearningHeader } from '../../../../components/learning-workspace/learning-header';
import { LearningNavigation } from '../../../../components/learning-workspace/learning-navigation';
import { AssetBrowser } from '../../../../components/learning-workspace/asset-browser';
import { MetricsPanel } from '../../../../components/learning-workspace/metrics-panel';
import { RecommendationPanel } from '../../../../components/learning-workspace/recommendation-panel';
import { ProgressPanel } from '../../../../components/learning-workspace/progress-panel';
import { presentationRegistry } from '../../../../components/learning-workspace/presentation-registry';
import { CitationDrawer } from '../../../../components/learning-workspace/citation-drawer';

function WorkspaceMain() {
  const { ui, learning, updateLearningSession } = useLearningWorkspace();
  const selectedAsset = learning.assets.find(a => a.assetId === ui.selectedAssetId);

  let Content = () => <div className="p-8 text-center text-muted-foreground">Select an asset to view.</div>;

  if (selectedAsset) {
    const Presenter = presentationRegistry.getPresenter(selectedAsset.assetType);
    Content = () => <Presenter asset={selectedAsset} onAction={updateLearningSession} />;
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar: Browser */}
      <div className="w-80 border-r flex flex-col bg-background">
        <AssetBrowser />
      </div>

      {/* Center: Main Presenter */}
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 p-8 overflow-y-auto">
        <Content />
      </div>

      {/* Right Sidebar: Context & Progress */}
      <div className="w-80 border-l flex flex-col bg-background">
        <div className="p-4 border-b">
          <ProgressPanel />
        </div>
        <div className="p-4 border-b">
          <MetricsPanel />
        </div>
        <div className="p-4 border-b">
          <RecommendationPanel />
        </div>
      </div>
      <CitationDrawer />
    </div>
  );
}

export default function LearningWorkspacePage() {
  const params = useParams();
  const documentId = params.documentId as string;

  return (
    <LearningWorkspaceProvider documentId={documentId}>
      <LearningWorkspaceLayout>
        <div className="flex flex-col w-full h-full">
          <LearningHeader documentId={documentId} />
          <LearningNavigation />
          <WorkspaceMain />
        </div>
      </LearningWorkspaceLayout>
    </LearningWorkspaceProvider>
  );
}
