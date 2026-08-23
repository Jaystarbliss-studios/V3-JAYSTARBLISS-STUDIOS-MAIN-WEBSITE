
import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`glass-skeleton-pulse rounded-md ${className}`} />
);

export const CardSkeleton: React.FC<{ className?: string; variant?: 'standard' | 'program' | 'service' | 'portfolio' | 'blog' }> = ({ 
  className = '', 
  variant = 'standard' 
}) => {
  if (variant === 'program') {
    return (
      <div className={`flex flex-col glass-card rounded-2xl sm:rounded-3xl overflow-hidden h-full ${className}`}>
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-6 sm:p-8 flex flex-col flex-grow space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4" />
          <div className="space-y-2 flex-grow">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="mt-auto pt-4 border-t border-slate-200/40 dark:border-white/5 flex items-center justify-between">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-8 w-1/4 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col glass-card rounded-2xl sm:rounded-3xl overflow-hidden h-full ${className}`}>
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-6 sm:p-8 flex flex-col flex-grow space-y-4">
        <Skeleton className="h-7 w-3/4" />
        <div className="space-y-2 flex-grow">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="mt-auto pt-4 border-t border-slate-200/40 dark:border-white/5 flex items-center justify-between">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-8 w-1/4 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export { GlassCardSkeleton, GlassGridSkeleton } from './GlassCardSkeleton';

