import React, { useRef, useState, useCallback } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  hoverEffect?: boolean;
  floatEffect?: boolean;
  rippleEffect?: boolean;
  scrollReveal?: boolean;
  delay?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverEffect = true,
  floatEffect = true,
  rippleEffect = true,
  scrollReveal = true,
  delay = 0,
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rippleEffect && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 1.5;
      const newRipple: Ripple = {
        x: clickX,
        y: clickY,
        size,
        id: Date.now() + Math.random(),
      };

      setRipples(prev => [...prev.slice(-3), newRipple]);
      window.setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 520);
    }

    onClick?.(e);
  }, [rippleEffect, onClick]);

  const baseClasses = 'glass-card glass-ripple-container rounded-2xl relative overflow-hidden';
  const hoverClasses = hoverEffect
    ? 'hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10'
    : '';

  const motionProps = scrollReveal ? {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-30px' },
    transition: {
      duration: 0.45,
      delay,
      ease: 'easeOut' as const,
    },
  } : {};

  return (
    <motion.div
      ref={cardRef}
      className={`${baseClasses} ${hoverClasses} ${className}`}
      onClick={handleCardClick}
      whileHover={floatEffect || hoverEffect ? {
        y: -4,
        transition: { duration: 0.18, ease: 'easeOut' as const },
      } : undefined}
      whileTap={rippleEffect ? { scale: 0.995 } : undefined}
      {...motionProps}
      {...props}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="glass-ripple"
          style={{
            left: `${ripple.x - ripple.size / 2}px`,
            top: `${ripple.y - ripple.size / 2}px`,
            width: `${ripple.size}px`,
            height: `${ripple.size}px`,
          }}
          aria-hidden="true"
        />
      ))}
      {children}
    </motion.div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 border-b border-slate-200/50 dark:border-white/10 ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`p-5 sm:p-6 border-t border-slate-200/50 dark:border-white/10 bg-white/30 dark:bg-slate-950/30 ${className}`} {...props}>
    {children}
  </div>
);
