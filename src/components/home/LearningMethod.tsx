import React from 'react';
import { StaggerGroup, Reveal } from '../ui/Reveal';
import { staggerItem } from '../ui/animationVariants';
import { motion } from 'motion/react';
import { usePageSection } from '../../lib/cms';

const steps = [
  {
    num: '01',
    title: 'LEARN',
    description: 'Understand the idea before trying to use it.',
  },
  {
    num: '02',
    title: 'PRACTICE',
    description: 'Work through exercises with guidance and feedback.',
  },
  {
    num: '03',
    title: 'BUILD',
    description: 'Apply the skill to a real project.',
  },
  {
    num: '04',
    title: 'LAUNCH',
    description: 'Finish the work and, where appropriate, publish or present it.',
  },
  {
    num: '05',
    title: 'SHOWCASE',
    description: 'Keep the finished work as part of a growing portfolio.',
  }
];

const LearningMethod: React.FC = () => {
  const { data } = usePageSection('home', 'learning_method', {
    title: 'LEARN. PRACTICE. BUILD. SHOWCASE.',
    subtitle: "We believe learning becomes much more meaningful when students get the chance to use what they've learned.",
    step1Title: '1. Foundation & Concepts', step1Desc: 'Master the core ideas before moving into application.',
    step2Title: '2. Guided Practice', step2Desc: 'Work through practical exercises with feedback from experienced mentors.',
    step3Title: '3. Independent Creation', step3Desc: 'Design and implement an original project using the skills you have developed.',
    step4Title: '4. Showcase & Presentation', step4Desc: 'Present the finished work and build a portfolio of real achievements.'
  });
  const steps = [
    { num: '01', title: data.step1Title, description: data.step1Desc },
    { num: '02', title: data.step2Title, description: data.step2Desc },
    { num: '03', title: data.step3Title, description: data.step3Desc },
    { num: '04', title: data.step4Title, description: data.step4Desc },
  ];
  return (
    <section className="py-24 bg-white dark:bg-slate-900 dark:border-slate-800 border-t border-gray-100">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <Reveal className="lg:col-span-5">
            <h2 className="text-3xl md:text-5xl font-extrabold text-brand-slate dark:text-white mb-6 tracking-tight leading-[1.1]">{data.title || 'LEARN. PRACTICE. BUILD. SHOWCASE.'}</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{data.subtitle || "We believe learning becomes much more meaningful when students get the chance to use what they've learned."}</p>
          </Reveal>
          <div className="lg:col-span-7">
            <StaggerGroup className="space-y-8" staggerDelay={0.12}>
              {steps.map((step) => (
                <motion.div key={step.num} variants={staggerItem} className="flex gap-6 group">
                  <div className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-white/10 flex items-center justify-center text-xl font-black text-brand-red shrink-0 group-hover:bg-brand-red group-hover:text-white group-hover:border-brand-red transition-all shadow-sm">{step.num}</div>
                  <div><h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3><p className="text-lg text-gray-600 dark:text-gray-400 font-medium">{step.description}</p></div>
                </motion.div>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LearningMethod;
