import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  AlertTriangle, X, Radio, ArrowRight, ShieldAlert, 
  Info, CheckCircle2 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BannerConfig {
  enabled: boolean;
  message: string;
  badgeText?: string;
  variant?: 'warning' | 'maintenance' | 'info' | 'emerald' | 'crimson';
  speed?: 'slow' | 'normal' | 'fast';
  linkUrl?: string;
  linkLabel?: string;
  showDismiss?: boolean;
}

const DEFAULT_BANNER: BannerConfig = {
  enabled: true,
  message: '⚡ Live System Notice: The website is currently undergoing active maintenance and progressive feature rollouts. Some modules, links, and resources may be dynamically updated in real-time. Thank you for learning and building with Jaystarbliss Studios!',
  badgeText: 'SYSTEM NOTICE',
  variant: 'maintenance',
  speed: 'normal',
  linkUrl: '/portal',
  linkLabel: 'Access Portal',
  showDismiss: true
};

export const MarqueeBanner: React.FC = () => {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_BANNER);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Subscribe to Firestore settings/banner in real-time
    const bannerRef = doc(db, 'settings', 'banner');
    
    // Initial fetch fallback
    getDoc(bannerRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as BannerConfig;
        setConfig(prev => ({ ...prev, ...data }));
      }
    }).catch(err => {
      console.warn('Banner doc fetch fallback error:', err);
    });

    const unsubscribe = onSnapshot(bannerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BannerConfig;
        setConfig(prev => ({ ...prev, ...data }));
      }
    }, (error) => {
      console.warn('Realtime banner subscription info:', error);
    });

    return () => unsubscribe();
  }, []);

  if (!config.enabled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Variant styling
  const variantStyles = {
    warning: {
      bg: 'bg-amber-500 text-slate-950 border-amber-400',
      icon: <AlertTriangle size={14} className="text-slate-950 shrink-0" />
    },
    maintenance: {
      bg: 'bg-slate-950/95 backdrop-blur-md text-amber-300 border-amber-500/40 shadow-2xl',
      icon: <Radio size={14} className="text-amber-400 animate-pulse shrink-0" />
    },
    crimson: {
      bg: 'bg-brand-red text-white border-red-400 shadow-xl',
      icon: <ShieldAlert size={14} className="text-white shrink-0" />
    },
    info: {
      bg: 'bg-blue-900/95 backdrop-blur-md text-blue-100 border-blue-500/40',
      icon: <Info size={14} className="text-blue-300 shrink-0" />
    },
    emerald: {
      bg: 'bg-emerald-950/95 backdrop-blur-md text-emerald-200 border-emerald-500/40',
      icon: <CheckCircle2 size={14} className="text-emerald-300 shrink-0" />
    }
  };

  const currentVariant = variantStyles[config.variant || 'maintenance'] || variantStyles.maintenance;

  // Animation duration based on speed
  const speedDuration = config.speed === 'slow' ? '45s' : config.speed === 'fast' ? '20s' : '30s';

  return (
    <aside 
      id="global-sticky-marquee-banner"
      aria-label="System Announcement Banner"
      className={`fixed bottom-0 left-0 right-0 z-50 border-t py-2 px-3 sm:px-4 flex items-center justify-between text-xs sm:text-sm font-medium transition-all ${currentVariant.bg}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-3 w-full overflow-hidden mr-2">
        {/* Scrolling text marquee */}
        <div className="relative flex-1 overflow-hidden h-6 flex items-center select-none">
          <div 
            className="flex items-center whitespace-nowrap gap-12 font-medium"
            style={{
              animation: `marqueeScroll ${speedDuration} linear infinite`,
              animationPlayState: isPaused ? 'paused' : 'running',
              willChange: 'transform'
            }}
          >
            <span className="flex items-center gap-2">
              {currentVariant.icon}
              {config.message}
            </span>
            <span className="opacity-40">• • •</span>
            <span className="flex items-center gap-2">
              {currentVariant.icon}
              {config.message}
            </span>
            <span className="opacity-40">• • •</span>
            <span className="flex items-center gap-2">
              {currentVariant.icon}
              {config.message}
            </span>
          </div>
        </div>

        {/* Action Link if provided */}
        {config.linkUrl && (
          <Link
            to={config.linkUrl}
            className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shrink-0"
          >
            <span>{config.linkLabel || 'Learn More'}</span>
            <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {/* Dismiss Button */}
      {config.showDismiss !== false && (
        <button
          id="dismiss-marquee-banner-btn"
          onClick={handleDismiss}
          className="p-1 rounded-full hover:bg-white/20 text-current transition-colors shrink-0 ml-1"
          aria-label="Dismiss banner"
          title="Dismiss banner"
        >
          <X size={15} />
        </button>
      )}

      {/* Global Style for the keyframes */}
      <style>{`
        @keyframes marqueeScroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </aside>
  );
};

export default MarqueeBanner;
