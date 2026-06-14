import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  className,
  label,
  error,
  icon,
  id,
  type = 'text',
  ...props
}) => {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-slate-500 flex items-center pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          className={cn(
            'w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200',
            {
              'pl-10': icon,
              'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20': error,
            },
            className,
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-rose-500 mt-0.5">{error}</span>}
    </div>
  );
};
