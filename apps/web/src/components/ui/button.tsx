import React from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { Spinner } from './spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  href?: string;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  href,
  ...props
}) => {
  const classes = cn(
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
    {
      // Size
      'px-3 py-1.5 text-sm': size === 'sm',
      'px-4 py-2 text-base': size === 'md',
      'px-6 py-3 text-lg': size === 'lg',

      // Variant
      'gradient-primary text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:-translate-y-0.5':
        variant === 'primary',
      'border border-slate-700 bg-slate-800/40 text-slate-100 hover:bg-slate-800 hover:border-slate-600':
        variant === 'secondary',
      'text-slate-300 hover:bg-slate-800/40 hover:text-slate-100': variant === 'ghost',
      'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/10': variant === 'danger',
    },
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...(props as any)}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4 mr-2 border-2 border-current" />}
      {children}
    </button>
  );
};
