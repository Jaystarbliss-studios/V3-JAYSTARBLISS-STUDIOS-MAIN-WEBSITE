import React from 'react';
import SEO from '../../components/ui/SEO';
import { AchievementBadgeGrid } from '../../components/ecosystem/AchievementBadge';
import { Award } from 'lucide-react';

const StudentAchievements: React.FC = () => {
  const studentName = sessionStorage.getItem('userName') || 'Student';
  return (
    <div className="space-y-6">
      <SEO title="Achievements & Mastery Badges | Jaystarbliss Studios" description="View your earned achievement and mastery badges." noindex />
      <section className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-brand-red/10 p-3 text-brand-red"><Award size={22} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-red">Student Progress</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Achievements & Mastery Badges</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Your verified achievements, mastery badges and learning recognition are kept here instead of crowding your dashboard.</p>
          </div>
        </div>
      </section>
      <AchievementBadgeGrid studentName={studentName} title="My Achievement & Mastery Badges" subtitle="Earn verifiable badges as you complete milestones and projects." />
    </div>
  );
};
export default StudentAchievements;
