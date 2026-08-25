import React from 'react';

interface CyberLiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  variant?: 'red' | 'gold';
}

export const CyberLiquidButton: React.FC<CyberLiquidButtonProps> = ({
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`cyber-liquid-button group relative w-full overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* 1. Base deep crimson background */}
      <div className="btn-base-bg absolute inset-0 z-0" />

      {/* 2. Glowing animated liquid plasma wave layers */}
      <div className="btn-liquid-waves absolute inset-0 z-1 pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* 3. Shimmer reflection beam */}
      <div className="btn-shimmer absolute inset-0 z-2 pointer-events-none" />

      {/* 4. Glowing crisp border aura */}
      <div className="btn-border-glow absolute inset-0 z-3 pointer-events-none rounded-[12px]" />

      {/* 5. Button Content & Typography */}
      <div className="relative z-10 flex items-center justify-center gap-2.5 py-3.5 px-6 font-mono text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-white">
        {loading && (
          <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        )}
        <span className="btn-label-text tracking-[0.16em]">
          {children}
        </span>
      </div>
    </button>
  );
};

export default CyberLiquidButton;
