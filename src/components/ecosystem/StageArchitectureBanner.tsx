import React, { useState } from 'react';
import { ECOSYSTEM_STAGES } from '../../data/learningEcosystem';
import { Compass, Hammer, Cpu, Rocket, Crown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ICON_COMPONENTS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Compass,
  Hammer,
  Cpu,
  Rocket,
  Crown
};

export const StageArchitectureBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [activeStage, setActiveStage] = useState<number>(1);

  const currentStage = ECOSYSTEM_STAGES.find(s => s.stage === activeStage) || ECOSYSTEM_STAGES[0];
  const IconComponent = ICON_COMPONENTS[currentStage.icon] || Compass;

  return (
    <div className={`w-full bg-slate-900 dark:bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden ${
      compact ? 'p-6 sm:p-8' : 'p-6 sm:p-8 lg:p-10'
    }`}>
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-2">
            Every Program Follows One Proven Learning Architecture
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Whether your child is learning Python, playing their first violin scale, crafting a digital brand, or preparing for WAEC, every course progresses through five deliberate mastery stages.
          </p>
        </div>

        {/* 5-Stage Step Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-6">
          {ECOSYSTEM_STAGES.map((stage) => {
            const isSelected = stage.stage === activeStage;
            const StageIcon = ICON_COMPONENTS[stage.icon] || Compass;

            return (
              <button
                key={stage.stage}
                type="button"
                onClick={() => setActiveStage(stage.stage)}
                className={`flex flex-col text-left p-3.5 sm:p-4 rounded-2xl transition-all duration-200 border relative ${
                  isSelected
                    ? 'bg-white/10 border-brand-red shadow-lg shadow-brand-red/10 scale-[1.02]'
                    : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md ${
                    isSelected ? 'bg-brand-red text-white' : 'bg-white/10 text-slate-400'
                  }`}>
                    STAGE 0{stage.stage}
                  </span>
                  <StageIcon size={16} className={isSelected ? 'text-brand-red' : 'text-slate-400'} />
                </div>
                <div className="text-sm font-black text-white">{stage.name}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{stage.tagline}</div>
              </button>
            );
          })}
        </div>

        {/* Active Stage Deep-Dive Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-6 rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-md"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-red/20 text-brand-red flex items-center justify-center shrink-0 border border-brand-red/30">
                  <IconComponent size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-brand-red uppercase tracking-wider">
                      Stage 0{currentStage.stage}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-300 font-bold">{currentStage.tagline}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {currentStage.name}
                  </h3>
                  <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed max-w-3xl">
                    {currentStage.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 text-xs font-bold text-slate-400">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Integrated in all 8 Programs</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StageArchitectureBanner;
