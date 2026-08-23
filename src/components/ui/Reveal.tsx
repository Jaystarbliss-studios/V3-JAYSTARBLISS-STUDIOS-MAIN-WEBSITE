import React from 'react';
import { motion } from 'motion/react';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}

/** Fades + slides an element up into place once when it enters the viewport. */
export const Reveal: React.FC<RevealProps> = ({ children, delay = 0, className = '', y = 24 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 'some' }}
    transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] as const }}
  >
    {children}
  </motion.div>
);

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

/** Wrap a grid/list of cards; each direct motion child reveals in sequence. */
export const StaggerGroup: React.FC<StaggerProps> = ({ children, className = '', staggerDelay = 0.09 }) => (
  <motion.div
    className={className}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 'some' }}
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: staggerDelay } },
    }}
  >
    {children}
  </motion.div>
);
