import React from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  to?: string;
  href?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  to,
  href,
  leftIcon,
  rightIcon,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled = false,
  type,
  ...props
}) => {
  const baseStyles = [
    'inline-flex items-center justify-center',
    'font-bold rounded-xl',
    'min-h-11',
    'transition-[background-color,border-color,color,box-shadow,transform,opacity]',
    'duration-180 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'touch-manipulation select-none',
  ].join(' ');

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand-red text-white hover:bg-red-700 focus-visible:ring-brand-red/50 active:scale-[0.98] hover:shadow-lg hover:shadow-brand-red/20',
    secondary: 'bg-brand-slate text-white hover:bg-gray-800 focus-visible:ring-brand-slate/50 active:scale-[0.98] hover:shadow-lg hover:shadow-brand-slate/20',
    outline: 'border-2 border-brand-slate/10 text-brand-slate hover:bg-brand-slate/5 focus-visible:ring-brand-slate/20 active:scale-[0.98] dark:border-white/10 dark:text-white dark:hover:bg-white/5',
    ghost: 'text-brand-slate hover:bg-brand-slate/5 focus-visible:ring-brand-slate/20 active:scale-[0.98] dark:text-white dark:hover:bg-white/5',
    danger: 'bg-red-100 text-red-700 hover:bg-red-200 focus-visible:ring-red-500/50 active:scale-[0.98] dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'text-sm px-4 py-2 gap-1.5',
    md: 'text-base px-6 py-3 gap-2',
    lg: 'text-lg px-8 py-4 gap-3',
    icon: 'w-11 h-11 p-0',
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
  const isDisabled = disabled || isLoading;

  const loadingIndicator = (
    <span
      className="mr-2 inline-flex h-5 w-5 shrink-0 animate-spin items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </span>
  );

  const content = (
    <>
      {isLoading ? loadingIndicator : leftIcon}
      <span className="min-w-0">{children}</span>
      {!isLoading && rightIcon}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`${classes}${isDisabled ? ' pointer-events-none' : ''}`}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={isDisabled ? undefined : href}
        className={`${classes}${isDisabled ? ' pointer-events-none' : ''}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {content}
    </button>
  );
};

export default Button;
