import React, { useState, useRef, useId, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delay = 200,
  disabled = false,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const showTooltip = () => {
    if (disabled || !content) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPositionClasses = () => {
    switch (placement) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (placement) {
      case 'bottom':
        return '-top-1 left-1/2 -translate-x-1/2 border-b-slate-900 dark:border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent';
      case 'left':
        return '-right-1 top-1/2 -translate-y-1/2 border-l-slate-900 dark:border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent';
      case 'right':
        return '-left-1 top-1/2 -translate-y-1/2 border-r-slate-900 dark:border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent';
      case 'top':
      default:
        return '-bottom-1 left-1/2 -translate-x-1/2 border-t-slate-900 dark:border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent';
    }
  };

  // Clone child to inject event handlers and accessibility attributes
  const child = React.isValidElement(children) ? children : <span>{children}</span>;
  const trigger = React.cloneElement(child, {
    'aria-describedby': isVisible && !disabled ? tooltipId : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      showTooltip();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e);
      hideTooltip();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      showTooltip();
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      hideTooltip();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      child.props.onKeyDown?.(e);
      if (e.key === 'Escape') hideTooltip();
    },
  });

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {trigger}
      <AnimatePresence>
        {isVisible && !disabled && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 border border-slate-700/60 rounded-lg shadow-xl shadow-black/20 whitespace-nowrap pointer-events-none ${getPositionClasses()}`}
          >
            {content}
            <div className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;
