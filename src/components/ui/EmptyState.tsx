import React from 'react';
import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
        <SearchX className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">{description}</p>
    </div>
  );
};

export default EmptyState;
