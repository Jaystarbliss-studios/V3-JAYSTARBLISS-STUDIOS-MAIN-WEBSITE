import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';


interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-neutral dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-brand-red rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Something went wrong
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                We've encountered an unexpected error. Please try refreshing the page or return to the homepage.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-3 px-4 bg-brand-slate text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-slate/90 transition-colors"
                >
                  <RefreshCw size={18} />
                  Refresh Page
                </button>
                <a 
                  href="/"
                  className="w-full py-3 px-4 bg-gray-100 dark:bg-slate-800 text-brand-slate dark:text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Home size={18} />
                  Return Home
                </a>
              </div>
            </div>
            {import.meta.env.MODE !== 'production' && this.state.error && (
              <div className="bg-red-50 dark:bg-red-950/20 p-4 border-t border-red-100 dark:border-red-900/30">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 break-words whitespace-pre-wrap">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
