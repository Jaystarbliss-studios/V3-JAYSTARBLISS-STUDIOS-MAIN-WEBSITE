import React from 'react';

interface GlassCardSkeletonProps {
  variant?: 'standard' | 'service' | 'program' | 'portfolio' | 'blog';
  className?: string;
}

export const GlassCardSkeleton: React.FC<GlassCardSkeletonProps> = ({
  variant = 'standard',
  className = '',
}) => {
  if (variant === 'service') {
    return (
      <div className={`glass-card h-[340px] rounded-2xl p-6 sm:p-8 flex flex-col justify-end relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-slate-200/40 dark:bg-slate-800/40" />
        <div className="relative z-10 space-y-4">
          <div className="w-12 h-12 rounded-xl glass-skeleton-pulse" />
          <div className="h-6 w-3/5 rounded-md glass-skeleton-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded glass-skeleton-pulse" />
            <div className="h-4 w-4/5 rounded glass-skeleton-pulse" />
          </div>
          <div className="h-4 w-28 rounded-md glass-skeleton-pulse mt-2" />
        </div>
      </div>
    );
  }

  if (variant === 'program') {
    return (
      <div className={`glass-card rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col h-full ${className}`}>
        <div className="h-48 w-full glass-skeleton-pulse" />
        <div className="p-6 sm:p-8 flex flex-col flex-grow space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-4 w-20 rounded-full glass-skeleton-pulse" />
            <div className="h-4 w-16 rounded-full glass-skeleton-pulse" />
          </div>
          <div className="h-6 w-3/4 rounded-md glass-skeleton-pulse" />
          <div className="space-y-2 flex-grow">
            <div className="h-4 w-full rounded glass-skeleton-pulse" />
            <div className="h-4 w-5/6 rounded glass-skeleton-pulse" />
          </div>
          <div className="pt-4 border-t border-slate-200/40 dark:border-white/5 flex justify-between items-center">
            <div className="h-4 w-24 rounded glass-skeleton-pulse" />
            <div className="h-4 w-4 rounded-full glass-skeleton-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'portfolio') {
    return (
      <div className={`glass-card rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col h-full ${className}`}>
        <div className="h-56 sm:h-64 w-full glass-skeleton-pulse" />
        <div className="p-6 sm:p-10 flex flex-col flex-grow space-y-4">
          <div className="flex gap-4">
            <div className="h-4 w-24 rounded glass-skeleton-pulse" />
            <div className="h-4 w-20 rounded glass-skeleton-pulse" />
          </div>
          <div className="h-7 w-2/3 rounded-md glass-skeleton-pulse" />
          <div className="space-y-2 flex-grow">
            <div className="h-4 w-full rounded glass-skeleton-pulse" />
            <div className="h-4 w-4/5 rounded glass-skeleton-pulse" />
          </div>
          <div className="pt-4 border-t border-slate-200/40 dark:border-white/5">
            <div className="h-4 w-32 rounded glass-skeleton-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'blog') {
    return (
      <div className={`glass-card rounded-2xl overflow-hidden flex flex-col h-full ${className}`}>
        <div className="aspect-[16/9] w-full glass-skeleton-pulse" />
        <div className="p-6 sm:p-7 flex flex-col flex-grow space-y-4">
          <div className="flex gap-3">
            <div className="h-3.5 w-20 rounded glass-skeleton-pulse" />
            <div className="h-3.5 w-24 rounded glass-skeleton-pulse" />
          </div>
          <div className="h-6 w-5/6 rounded-md glass-skeleton-pulse" />
          <div className="space-y-2 flex-grow">
            <div className="h-4 w-full rounded glass-skeleton-pulse" />
            <div className="h-4 w-3/4 rounded glass-skeleton-pulse" />
          </div>
          <div className="h-4 w-28 rounded glass-skeleton-pulse mt-auto" />
        </div>
      </div>
    );
  }

  // Default Standard Skeleton Card
  return (
    <div className={`glass-card rounded-2xl p-6 sm:p-8 space-y-4 ${className}`}>
      <div className="w-12 h-12 rounded-xl glass-skeleton-pulse" />
      <div className="h-6 w-2/3 rounded-md glass-skeleton-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded glass-skeleton-pulse" />
        <div className="h-4 w-4/5 rounded glass-skeleton-pulse" />
      </div>
      <div className="pt-4 border-t border-slate-200/40 dark:border-white/5 flex justify-between items-center">
        <div className="h-4 w-24 rounded glass-skeleton-pulse" />
        <div className="h-4 w-4 rounded-full glass-skeleton-pulse" />
      </div>
    </div>
  );
};

interface GlassGridSkeletonProps {
  count?: number;
  variant?: 'standard' | 'service' | 'program' | 'portfolio' | 'blog';
  columns?: string;
  className?: string;
}

export const GlassGridSkeleton: React.FC<GlassGridSkeletonProps> = ({
  count = 3,
  variant = 'standard',
  columns = 'grid-cols-1 md:grid-cols-3',
  className = '',
}) => {
  return (
    <div className={`grid ${columns} gap-6 sm:gap-8 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <GlassCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
};

export default GlassCardSkeleton;
