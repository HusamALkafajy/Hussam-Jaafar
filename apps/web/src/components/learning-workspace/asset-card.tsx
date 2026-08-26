import React from 'react';
import { LearningAsset } from '@studyai/domain/learning-asset';
import { useLearningWorkspace } from './learning-workspace-provider';
import { cn } from '../../lib/utils';
import { FileText, Layers, Target, FileSearch } from 'lucide-react';

const TYPE_ICONS: Record<string, any> = {
  Flashcard: Layers,
  QuizQuestion: Target,
  RevisionPlan: FileSearch,
  Summary: FileText,
  MindMap: FileText,
  ConceptGraph: FileText
};

export function AssetCard({ asset }: { asset: LearningAsset }) {
  const { ui, updateUI } = useLearningWorkspace();
  const Icon = TYPE_ICONS[asset.assetType] || FileText;

  const isSelected = ui.selectedAssetId === asset.assetId;

  return (
    <button
      onClick={() => updateUI({ selectedAssetId: asset.assetId })}
      className={cn(
        "flex flex-col gap-2 p-3 w-full text-left border rounded-lg transition-colors",
        isSelected ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          {asset.assetType}
        </div>
        <span className={cn(
          "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
          asset.difficulty === 'Hard' ? "bg-red-500/10 text-red-600" :
          asset.difficulty === 'Medium' ? "bg-yellow-500/10 text-yellow-600" :
          "bg-emerald-500/10 text-emerald-600"
        )}>
          {asset.difficulty}
        </span>
      </div>
      <div className="text-sm font-medium line-clamp-2">
        {asset.content?.front || asset.content?.title || asset.content?.question || asset.content?.summary || 'Untitled Asset'}
      </div>
    </button>
  );
}
