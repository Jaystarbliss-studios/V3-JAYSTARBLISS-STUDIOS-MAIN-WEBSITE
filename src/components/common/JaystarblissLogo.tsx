import React, { useState } from 'react';
import logoImg from '../../assets/Untitled design.png';

interface JaystarblissLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textColor?: string;
  subtextColor?: string;
}

export const JaystarblissIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = 'w-9 h-9',
  size 
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div 
      className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm shrink-0 bg-brand-slate border border-white/10 ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      {!imgError ? (
        <img
          src={logoImg || '/Untitled design.png'}
          alt="Jaystarbliss Studios Logo"
          className="w-full h-full object-cover select-none grayscale contrast-125 brightness-105"
          onError={() => setImgError(true)}
          loading="eager"
        />
      ) : (
        <img
          src="/logo.png"
          alt="Jaystarbliss Studios Logo"
          className="w-full h-full object-cover select-none grayscale contrast-125 brightness-105"
          onError={(e) => {
            // Ultimate fallback to direct public path
            (e.target as HTMLImageElement).src = '/Untitled design.png';
          }}
        />
      )}
    </div>
  );
};

export const JaystarblissLogo: React.FC<JaystarblissLogoProps> = ({
  className = '',
  size = 36,
  showText = true,
  textColor = 'text-white',
  subtextColor = 'text-white/60'
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <JaystarblissIcon size={size} />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-black tracking-tight leading-tight whitespace-nowrap ${textColor}`}>
            JAYSTARBLISS
          </span>
          <span className={`text-[10px] font-bold tracking-widest uppercase ${subtextColor}`}>
            STUDIOS
          </span>
        </div>
      )}
    </div>
  );
};

export default JaystarblissLogo;
