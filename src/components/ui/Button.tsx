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
  isLoading,
  fullWidth,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-brand-red text-white hover:bg-red-700 focus:ring-brand-red/50 hover:shadow-lg hover:shadow-brand-red/20',
    secondary: 'bg-brand-slate text-white hover:bg-gray-800 focus:ring-brand-slate/50 hover:shadow-lg hover:shadow-brand-slate/20',
    outline: 'border-2 border-brand-slate/10 text-brand-slate hover:bg-brand-slate/5 focus:ring-brand-slate/20 dark:border-white/10 dark:text-white dark:hover:bg-white/5',
    ghost: 'text-brand-slate hover:bg-brand-slate/5 focus:ring-brand-slate/20 dark:text-white dark:hover:bg-white/5',
    danger: 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500/50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  };

  const sizes = {
    sm: 'text-sm px-4 py-2 gap-1.5',
    md: 'text-base px-6 py-3 gap-2',
    lg: 'text-lg px-8 py-4 gap-3',
    icon: 'p-3',
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  const content = (
    <>
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return (
    <button className={classes} disabled={disabled || isLoading} {...props}>
      {content}
    </button>
  );
};

export default Button;
