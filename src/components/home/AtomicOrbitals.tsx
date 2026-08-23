import React from 'react';
import { Paintbrush, Cpu, Hash, Type } from 'lucide-react';
import { JaystarblissIcon } from '../common/JaystarblissLogo';

interface OrbitProps {
  rotationZ: number;
  duration: number;
  color: string;
  delay: string;
  Icon: any;
}

const AtomOrbit: React.FC<OrbitProps> = ({ rotationZ, duration, color, delay, Icon }) => {
  return (
    <div 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]"
      style={{ 
        transform: `rotateZ(${rotationZ}deg) rotateX(72deg)`, 
        transformStyle: 'preserve-3d' 
      }}
    >
      {/* Faint complete ring */}
      <div className="absolute inset-0 rounded-full border border-white/5" />

      {/* Spinning container */}
      <div 
        className="absolute inset-0"
        style={{ 
          animation: `spin-3d ${duration}s linear infinite`,
          animationDelay: delay,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Comet Trail */}
        <div 
          className="absolute inset-0 rounded-full opacity-80"
          style={{
            background: `conic-gradient(from 0deg, transparent 0%, transparent 50%, ${color} 100%)`,
            WebkitMaskImage: 'radial-gradient(closest-side, transparent calc(100% - 3px), black calc(100% - 2px))',
            maskImage: 'radial-gradient(closest-side, transparent calc(100% - 3px), black calc(100% - 2px))',
            transform: 'rotate(-90deg)' // Position the thickest part at top center
          }}
        />

        {/* The Icon Node */}
        <div 
          className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white dark:bg-slate-900 dark:border-slate-800 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center border-4"
          style={{ 
            borderColor: color,
            color: color,
            animation: `spin-3d-reverse ${duration}s linear infinite`,
            animationDelay: delay,
          }}
        >
           {/* Counter the 3D tilt so icon faces camera perfectly */}
           <div style={{ transform: `rotateX(-72deg) rotateZ(${-rotationZ}deg)` }}>
             <Icon size={20} strokeWidth={2.5} />
           </div>
        </div>
      </div>
    </div>
  );
};

const AtomicOrbitals: React.FC = () => {
  return (
    <div className="relative w-full max-w-[500px] aspect-square flex items-center justify-center mx-auto">
      {/* Custom Keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin-3d {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-3d-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes pulse-core {
          0%, 100% { box-shadow: 0 0 40px rgba(220, 38, 38, 0.4), 0 0 100px rgba(220, 38, 38, 0.2); transform: scale(1); }
          50% { box-shadow: 0 0 60px rgba(220, 38, 38, 0.6), 0 0 120px rgba(220, 38, 38, 0.3); transform: scale(1.05); }
        }
      `}} />

      {/* Orbit 1: Red */}
      <AtomOrbit 
        rotationZ={30} 
        duration={12} 
        color="#dc2626" 
        delay="0s" 
        Icon={Hash} 
      />
      
      {/* Orbit 2: Yellow/Gold */}
      <AtomOrbit 
        rotationZ={150} 
        duration={15} 
        color="#eab308" 
        delay="-5s" 
        Icon={Paintbrush} 
      />
      
      {/* Orbit 3: Red (Alt) */}
      <AtomOrbit 
        rotationZ={-90} 
        duration={18} 
        color="#dc2626" 
        delay="-10s" 
        Icon={Type} 
      />

      {/* Orbit 4: Gold (Alt) */}
      <AtomOrbit 
        rotationZ={-30} 
        duration={14} 
        color="#eab308" 
        delay="-7s" 
        Icon={Cpu} 
      />

      {/* Central Black Hole / Logo Hub */}
      <div 
        className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 bg-black rounded-full border-2 border-white/20 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
        style={{ animation: 'pulse-core 4s ease-in-out infinite' }}
        onClick={() => window.location.href = '/portal'}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-brand-red/20 to-transparent opacity-50"></div>
        <JaystarblissIcon className="w-20 h-20 sm:w-24 sm:h-24 relative z-10 shadow-2xl" />
      </div>
    </div>
  );
};

export default AtomicOrbitals;
