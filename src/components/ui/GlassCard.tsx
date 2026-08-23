import React, { useRef, useState, useCallback } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  hoverEffect?: boolean;
  floatEffect?: boolean;
  rippleEffect?: boolean;
  scrollReveal?: boolean;
  subtle?: boolean;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  hoverEffect = true,
  floatEffect = true,
  rippleEffect = true,
  scrollReveal = true,
  subtle = false,
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

      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 700);
    }

    if (onClick) {
      onClick(e);
    }
  }, [rippleEffect, onClick]);

  const baseCardClasses = subtle 
    ? 'glass-card-subtle glass-ripple-container rounded-2xl relative overflow-hidden' 
    : 'glass-card glass-ripple-container rounded-2xl relative overflow-hidden';
  
  const hoverClasses = hoverEffect 
    ? 'hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer' 
    : '';

  // Scroll-triggered Fade-In-Up motion animation
  const motionProps = scrollReveal ? {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-30px' },
    transition: { 
      duration: 0.55, 
      delay, 
      ease: 'easeOut' as const
    },
  } : {};

  return (
    <motion.div 
      ref={cardRef}
      className={`${baseCardClasses} ${hoverClasses} ${className}`}
      onClick={handleCardClick}
      whileHover={floatEffect ? { 
        y: -6,
        transition: { duration: 0.28, ease: 'easeOut' as const } 
      } : undefined}
      whileTap={rippleEffect ? { scale: 0.985 } : undefined}
      {...motionProps}
      {...props}
    >
      {/* Click-based Ripple Elements */}
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
        />
      ))}

      {children}
    </motion.div>
  );
};

export default GlassCard;
