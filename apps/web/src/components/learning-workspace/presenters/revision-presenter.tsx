import React from 'react';
import { PresenterProps } from '../presentation-registry';

export const RevisionPresenter: React.FC<PresenterProps> = ({ asset }) => {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl h-full gap-8 text-center text-muted-foreground p-12 border rounded-2xl border-dashed">
      <h2 className="text-xl font-semibold text-foreground">Revision Interaction Placeholder</h2>
      <p>This workspace will present {asset.assetType} assets in future epics.</p>
    </div>
  );
};
