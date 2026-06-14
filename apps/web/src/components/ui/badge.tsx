import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'primary',
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold select-none border',
        {
          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20': variant === 'primary',
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': variant === 'success',
          'bg-amber-500/10 text-amber-400 border-amber-500/20': variant === 'warning',
          'bg-rose-500/10 text-rose-400 border-rose-500/20': variant === 'danger',
          'bg-slate-500/10 text-slate-400 border-slate-500/20': variant === 'neutral',
        },
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
