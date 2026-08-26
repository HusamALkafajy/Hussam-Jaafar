'use client';

import React from 'react';
import { useLearningWorkspace } from './learning-workspace-provider';
import { AssetCard } from './asset-card';
import { Input } from '../ui/input';
import { Search, Filter } from 'lucide-react';
import { Button } from '../ui/button';

export function AssetBrowser() {
  const { ui, learning, updateUI } = useLearningWorkspace();

  // Filter assets by selected tab type
  const tabTypeMap: Record<string, string[]> = {
    Flashcards: ['Flashcard'],
    Quiz: ['QuizQuestion'],
    Revision: ['RevisionPlan'],
    Summaries: ['Summary']
  };

  const allowedTypes = tabTypeMap[ui.selectedTab] || [];
  
  let displayedAssets = learning.assets.filter(a => allowedTypes.includes(a.assetType));

  if (ui.search) {
    const q = ui.search.toLowerCase();
    displayedAssets = displayedAssets.filter(a => 
      JSON.stringify(a.content).toLowerCase().includes(q)
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold">{ui.selectedTab}</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search..." 
              className="pl-8 h-8 text-sm"
              value={ui.search}
              onChange={(e) => updateUI({ search: e.target.value })}
            />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {displayedAssets.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No assets found.
          </div>
        ) : (
          displayedAssets.map(asset => (
            <AssetCard key={asset.assetId} asset={asset} />
          ))
        )}
      </div>
    </div>
  );
}
