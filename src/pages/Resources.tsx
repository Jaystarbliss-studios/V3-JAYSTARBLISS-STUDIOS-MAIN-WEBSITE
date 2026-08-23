import React from 'react';
import MainLayout from '../components/layout/MainLayout';
import SEO from '../components/ui/SEO';
import { BookOpen, FileText, HelpCircle, PenTool, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const Resources: React.FC = () => {
  const resourceItems = [
    {
      title: "Curriculum & Resource Library",
      desc: "Browse and download termly syllabi, lesson notes, and hands-on coding worksheets for students, parents, and partner school educators.",
      link: "/portal",
      label: "OPEN RESOURCE PORTAL",
      icon: BookOpen,
      active: true
    },
    {
      title: "FAQ",
      desc: "Find answers to common questions about our educational programs, digital services, timelines, and how we collaborate.",
      link: "/faq",
      label: "VIEW FAQs",
      icon: HelpCircle,
      active: true
    },
    {
      title: "Blog",
      desc: "Articles, case studies, and insights on education, technology, and creativity. Read our thoughts on building better digital experiences.",
      link: "/blog",
      label: "VIEW POSTS",
      icon: PenTool,
      active: true
    },
    {
      title: "Privacy Policy",
      desc: "Learn how we collect, use, and protect your personal information when you use our services or enroll in our programs.",
      link: "#",
      label: "VIEW POLICY",
      icon: FileText,
      active: false
    }
  ];

  return (
    <MainLayout>
      <SEO 
        title="Resources & Insights" 
        description="Tools, articles, guidelines, and answers to help you learn, build, and grow with Jaystarbliss Studios." 
      />

      {/* Header Banner */}
      <div className="bg-brand-slate text-white py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10 text-center">
          <span className="inline-block text-xs font-black uppercase tracking-widest text-brand-red mb-3">
            Knowledge Base
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 tracking-tight">
            RESOURCES & INSIGHTS
          </h1>
          <p className="text-base sm:text-lg text-white/80 leading-relaxed font-normal max-w-2xl mx-auto">
            Tools, articles, and answers to help you learn, build, and grow with Jaystarbliss Studios.
          </p>
        </div>
      </div>

      {/* Resources Editorial Grid */}
      <div className="py-16 md:py-24 bg-brand-neutral dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            
            {resourceItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -6, transition: { duration: 0.28, ease: 'easeOut' } }}
                  className="h-full"
                >
                  <Link 
                    to={item.link} 
                    className={`group flex flex-col h-full p-6 sm:p-10 rounded-2xl glass-card transition-all duration-300 ${!item.active ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                      <div className="w-12 h-12 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon size={24} />
                      </div>
                      {item.active && (
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-brand-red group-hover:text-white transition-colors">
                          <ArrowUpRight size={16} />
                        </div>
                      )}
                    </div>

                    <h2 className="text-2xl font-extrabold text-brand-slate dark:text-white mb-3 group-hover:text-brand-red transition-colors">
                      {item.title}
                    </h2>

                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed mb-8 flex-grow">
                      {item.desc}
                    </p>

                    <div className="pt-4 border-t border-slate-200/50 dark:border-white/10 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-brand-red group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        {item.label} &rarr;
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}

          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Resources;
