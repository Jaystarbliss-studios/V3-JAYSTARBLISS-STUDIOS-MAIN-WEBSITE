import React from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
  return (
    <section
      aria-labelledby="empty-state-title"
      className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800"
    >
      <div
        className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-5 ring-1 ring-black/5 dark:ring-white/5"
        aria-hidden="true"
      >
        <SearchX className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 id="empty-state-title" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 text-balance">
        {title}
      </h3>
      <p className="text-sm sm:text-base leading-6 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
};

export default EmptyState;
