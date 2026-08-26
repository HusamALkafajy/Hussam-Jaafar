import React from 'react';
import { cn } from '../../lib/utils';

export const Spinner: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'w-6 h-6 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin',
        className,
      )}
      {...props}
    />
  );
};
