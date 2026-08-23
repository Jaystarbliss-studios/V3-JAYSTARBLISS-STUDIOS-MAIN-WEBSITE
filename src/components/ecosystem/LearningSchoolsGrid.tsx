import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  LEARNING_SCHOOLS, 
  type LearningSchool
} from '../../data/learningEcosystem';
import { 
  Laptop, 
  Palette, 
  Music, 
  Brain, 
  GraduationCap, 
  Gamepad2, 
  Baby, 
  Users,
  ArrowRight,
  Layers,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import Button from '../ui/Button';
import { getAcademyImage } from '../../lib/stockImages';
import { StaggerGroup } from '../ui/Reveal';
import { staggerItem } from '../ui/animationVariants';
import { motion, AnimatePresence } from 'motion/react';

const SCHOOL_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Laptop,
  Palette,
  Music,
  Brain,
  GraduationCap,
  Gamepad2,
  Baby,
  Users
};

export const LearningSchoolsGrid: React.FC<{
  onSelectSchool?: (school: LearningSchool) => void;
  defaultExpandedSchoolId?: string;
  selectedSchoolId?: string;
  onSchoolChange?: (schoolId: string) => void;
}> = ({ defaultExpandedSchoolId, selectedSchoolId: controlledSchoolId, onSchoolChange, onSelectSchool }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    const initialId = controlledSchoolId || defaultExpandedSchoolId || LEARNING_SCHOOLS[0].id;
    const match = LEARNING_SCHOOLS.find(s => s.id === initialId || s.slug === initialId);
    return match ? match.id : LEARNING_SCHOOLS[0].id;
  });
  // Which pathway accordion row is open (replaces the old separate "pathway tab" bar)
  const [openPathwayIdx, setOpenPathwayIdx] = useState<number>(0);
  const [showStageBreakdown, setShowStageBreakdown] = useState(false);

  React.useEffect(() => {
    if (controlledSchoolId) {
      const match = LEARNING_SCHOOLS.find(s => s.id === controlledSchoolId || s.slug === controlledSchoolId);
      if (match && match.id !== selectedSchoolId) {
        setSelectedSchoolId(match.id);
        setOpenPathwayIdx(0);
        setShowStageBreakdown(false);
      }
    }
  }, [controlledSchoolId, selectedSchoolId]);

  const currentSchool = LEARNING_SCHOOLS.find(s => s.id === selectedSchoolId) || LEARNING_SCHOOLS[0];
  const SchoolIcon = SCHOOL_ICONS[currentSchool.iconName] || Layers;

  const handleSelectSchool = (school: LearningSchool) => {
    setSelectedSchoolId(school.id);
    setOpenPathwayIdx(0);
    setShowStageBreakdown(false);
    if (onSchoolChange) onSchoolChange(school.id);
    if (onSelectSchool) onSelectSchool(school);
  };

  return (
    <div id="school-hub" className="space-y-10 scroll-mt-24">
      
      {/* Step 1: Pick an academy — photo cards instead of flat icon tiles */}
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-brand-red text-white flex items-center justify-center text-[10px]">1</span>
          Choose an academy to explore its pathways
        </p>
        <StaggerGroup className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3" staggerDelay={0.05}>
          {LEARNING_SCHOOLS.map((school) => {
            const isSelected = school.id === selectedSchoolId;
            const Icon = SCHOOL_ICONS[school.iconName] || Layers;

            return (
              <motion.button
                key={school.id}
                variants={staggerItem}
                id={`school-tab-${school.id}`}
                type="button"
                onClick={() => handleSelectSchool(school)}
                className={`relative rounded-2xl border text-left transition-all duration-200 overflow-hidden group h-40 ${
                  isSelected
                    ? 'border-brand-red shadow-lg shadow-brand-red/10 ring-2 ring-brand-red/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <img
                  src={getAcademyImage(school.id)}
                  alt=""
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${isSelected ? 'from-brand-red/90 via-brand-red/40' : 'from-slate-950/90 via-slate-950/40'} to-transparent transition-colors`} />

                <div className="relative z-10 h-full flex flex-col justify-between p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
                      <Icon size={16} />
                    </div>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div>
                    <h3 className="font-black text-xs sm:text-sm text-white tracking-tight line-clamp-1">
                      {school.name.replace('School of ', '')}
                    </h3>
                    <p className="text-[10px] text-white/75 mt-0.5 line-clamp-2">
                      {school.shortDescription}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </StaggerGroup>
      </div>

      {/* Step 2: Deep-dive on the selected academy */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSchool.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
        >
          {/* School Header Banner — now with the academy photo instead of flat slate */}
          <div className="relative p-6 sm:p-8 lg:p-10 text-white overflow-hidden">
            <img src={getAcademyImage(currentSchool.id)} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-red text-white flex items-center justify-center font-bold">
                    <SchoolIcon size={20} />
                  </div>
                </div>
                
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                  {currentSchool.name}
                </h2>
                
                <p className="text-sm sm:text-base text-slate-200 mt-2 font-medium">
                  {currentSchool.tagline}
                </p>
                
                <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed">
                  {currentSchool.longDescription}
                </p>

                <div className="flex flex-wrap gap-2 mt-4">
                  {currentSchool.disciplines.map((d) => (
                    <span 
                      key={d}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white border border-white/10"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="shrink-0 flex flex-col gap-3 bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/15 self-start lg:self-center">
                <span className="text-xs text-slate-200 font-bold">Ready to enroll or request a school plan?</span>
                <Button
                  to="/contact"
                  className="bg-brand-red hover:bg-red-700 text-white font-extrabold uppercase tracking-wider text-xs shadow-lg shadow-brand-red/20"
                  rightIcon={<ArrowRight size={14} />}
                >
                  Request This Programme
                </Button>
                <Link 
                  to="/register" 
                  className="text-xs font-bold text-center text-slate-200 hover:text-white underline"
                >
                  Enroll in Live Cohort
                </Link>
              </div>
            </div>
          </div>

          {/* Pathways — accordion instead of a second tab bar */}
          <div className="p-6 sm:p-8 lg:p-10 space-y-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-red text-white flex items-center justify-center text-[10px]">2</span>
              Open a pathway to see its levels
            </p>

            {currentSchool.pathways.map((pathway, idx) => {
              const isOpen = openPathwayIdx === idx;
              return (
                <div
                  key={pathway.id}
                  className={`rounded-2xl border transition-colors ${isOpen ? 'border-brand-red/40 bg-brand-red/[0.03]' : 'border-slate-200 dark:border-slate-800'}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenPathwayIdx(isOpen ? -1 : idx)}
                    className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left"
                  >
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {pathway.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {pathway.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-brand-red/10 text-brand-red dark:bg-brand-red/20 whitespace-nowrap">
                        {pathway.ageRange}
                      </span>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-brand-red' : ''}`} />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-5 pt-0">
                          {pathway.levels.map((lvl, index) => (
                            <div 
                              key={lvl.title + index}
                              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-3 hover:border-brand-red/40 transition-colors"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-red bg-brand-red/10 px-2 py-0.5 rounded-md">
                                    {lvl.level}
                                  </span>
                                  <span className="text-slate-400 text-xs font-bold">Step 0{index + 1}</span>
                                </div>
                                <h5 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                  {lvl.title}
                                </h5>
                              </div>

                              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                {lvl.topics.map((topic) => (
                                  <div key={topic} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                                    <span>{topic}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* 5-Stage breakdown — collapsed by default since the same 5 stages are already
                introduced once above via StageArchitectureBanner; keeping all the data,
                just not repeating a full grid for every single academy by default. */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-2">
              <button
                type="button"
                onClick={() => setShowStageBreakdown(v => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  How the 5-stage framework applies to {currentSchool.name.replace('School of ', '')}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showStageBreakdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {showStageBreakdown && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4">
                      {[
                        { stage: 'Stage 1: Discover', items: currentSchool.stagesFramework.discover },
                        { stage: 'Stage 2: Build', items: currentSchool.stagesFramework.build },
                        { stage: 'Stage 3: Apply', items: currentSchool.stagesFramework.apply },
                        { stage: 'Stage 4: Create', items: currentSchool.stagesFramework.create },
                        { stage: 'Stage 5: Master', items: currentSchool.stagesFramework.master }
                      ].map((s) => (
                        <div key={s.stage} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-black text-brand-red uppercase mb-2">
                            {s.stage}
                          </div>
                          <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                            {s.items.map((item) => (
                              <li key={item} className="line-clamp-2">• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LearningSchoolsGrid;
