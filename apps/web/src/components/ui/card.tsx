import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  glass = true,
  hoverable = true,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border p-5 transition-all duration-300',
        {
          'glass border-slate-800/40': glass,
          'border-slate-800 bg-slate-900/40': !glass,
          'glass-hover cursor-pointer': hoverable && glass,
          'hover:-translate-y-1 hover:border-slate-700/60 hover:shadow-lg': hoverable && !glass,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
