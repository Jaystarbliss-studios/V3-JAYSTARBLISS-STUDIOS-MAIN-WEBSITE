import React, { useState } from 'react';
import { 
  BookOpen, Code, CheckCircle2, 
  PlayCircle, ExternalLink,
  Award, Layers
} from 'lucide-react';
import SEO from '../../components/ui/SEO';

interface CourseModule {
  id: string;
  stage: number;
  stageName: string;
  title: string;
  description: string;
  topics: string[];
  lessonsCount: number;
  duration: string;
  completedLessons: number;
  badgeUnlocked?: boolean;
}

const MODULES: CourseModule[] = [
  {
    id: 'm1',
    stage: 1,
    stageName: 'Stage 1: Logic & Algorithms',
    title: 'Blockly, Scratch & Computational Thinking',
    description: 'Foundations of programmatic logic, coordinate systems, loops, condition branches, and event listeners.',
    topics: ['Loops & Iterations', 'Conditionals (If-Else)', 'Variable Scoping', 'Event-Driven Programming'],
    lessonsCount: 8,
    duration: '4 Weeks',
    completedLessons: 8,
    badgeUnlocked: true
  },
  {
    id: 'm2',
    stage: 2,
    stageName: 'Stage 2: Core Scripting',
    title: 'Python Essentials & Data Structures',
    description: 'Transition from visual blocks to text-based code with Python 3, object-oriented concepts, and functions.',
    topics: ['Data Types & Collections', 'Custom Functions & Returns', 'File I/O & Modules', 'Algorithmic Problem Solving'],
    lessonsCount: 12,
    duration: '6 Weeks',
    completedLessons: 9,
    badgeUnlocked: true
  },
  {
    id: 'm3',
    stage: 3,
    stageName: 'Stage 3: Frontend & Creative Web',
    title: 'Modern Web Architecture: HTML, CSS & React',
    description: 'Build interactive web applications, responsive layouts with Tailwind CSS, and single-page apps with React.',
    topics: ['Semantic HTML5 & CSS Grid/Flexbox', 'Tailwind Utility Architecture', 'React State & Hooks', 'Component Lifecycles'],
    lessonsCount: 14,
    duration: '8 Weeks',
    completedLessons: 5,
    badgeUnlocked: false
  },
  {
    id: 'm4',
    stage: 4,
    stageName: 'Stage 4: AI & Machine Learning',
    title: 'Gemini AI Integration, Data & Vision',
    description: 'Integrate generative AI APIs, prompt engineering protocols, computer vision classifiers, and automated bots.',
    topics: ['Gemini Generative SDKs', 'Prompt Engineering', 'Computer Vision Inference', 'Full-stack AI Bots'],
    lessonsCount: 10,
    duration: '6 Weeks',
    completedLessons: 0,
    badgeUnlocked: false
  },
  {
    id: 'm5',
    stage: 5,
    stageName: 'Stage 5: Capstone Innovation',
    title: 'Production Deployment & Patent Defense',
    description: 'End-to-end full stack software release, cloud containerization, database schemas, and demo day exhibition.',
    topics: ['Cloud Architecture & CI/CD', 'Firestore Cloud Schemas', 'Security & Access Rules', 'Grand Demo Day Pitch'],
    lessonsCount: 6,
    duration: '4 Weeks',
    completedLessons: 0,
    badgeUnlocked: false
  }
];

export const PortalCourses: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<CourseModule>(MODULES[1]);

  return (
    <div className="space-y-6">
      <SEO 
        title="Curriculum & Course Tracks | Jaystarbliss Studios" 
        description="Comprehensive 5-stage STEM and Software Engineering curriculum syllabus." 
        noindex={true}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1">
            <Layers size={14} /> 5-Stage Engineering Path
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
            Enrolled Course Tracks
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Step-by-step masterclasses designed to take students from logic fundamentals to AI full-stack deployment.
          </p>
        </div>

        <a
          href="https://scratch.mit.edu"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-slate hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
        >
          <Code size={14} className="text-brand-red" /> Launch Scratch / Replit IDE <ExternalLink size={12} />
        </a>
      </div>

      {/* Modules Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Module List Sidebar */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 px-1">Curriculum Stages</h2>
          {MODULES.map(mod => {
            const isSelected = selectedModule.id === mod.id;
            const progress = Math.round((mod.completedLessons / mod.lessonsCount) * 100);

            return (
              <button
                key={mod.id}
                onClick={() => setSelectedModule(mod)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'border-brand-red bg-white dark:bg-slate-900 shadow-md ring-1 ring-brand-red/20' 
                    : 'border-gray-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-extrabold uppercase text-brand-red">
                    {mod.stageName}
                  </span>
                  {mod.badgeUnlocked && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                      <Award size={10} /> Certified
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2 line-clamp-1">
                  {mod.title}
                </h3>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{mod.completedLessons} of {mod.lessonsCount} lessons</span>
                    <span className="font-bold">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-brand-red'}`} 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Module Detail */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className="px-3 py-1 bg-brand-red/10 text-brand-red font-bold text-xs rounded-lg uppercase tracking-wider">
                {selectedModule.stageName}
              </span>
              <span className="text-xs text-gray-500 font-medium">Duration: {selectedModule.duration}</span>
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
              {selectedModule.title}
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {selectedModule.description}
            </p>

            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Core Subject Syllabus</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedModule.topics.map((topic, i) => (
                  <div 
                    key={i} 
                    className="p-3.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-950 flex items-center gap-3 text-xs font-semibold text-gray-800 dark:text-gray-200"
                  >
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    <span>{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BookOpen size={16} className="text-brand-red" />
              <span>Full curriculum notes & lab workbooks included.</span>
            </div>

            <button
              onClick={() => alert(`Starting interactive lab for ${selectedModule.title}`)}
              className="px-5 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <PlayCircle size={15} /> Resume Active Lesson
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PortalCourses;
