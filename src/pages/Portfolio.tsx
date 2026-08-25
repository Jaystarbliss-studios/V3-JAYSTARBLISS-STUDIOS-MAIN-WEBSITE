import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import MainLayout from '../components/layout/MainLayout';
import SEO from '../components/ui/SEO';
import { motion } from 'motion/react';
import { 
  ExternalLink, 
  Gamepad2, 
  Briefcase, 
  Zap, 
  X, 
  Search,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import DOMPurify from 'dompurify';
import Badge from '../components/ui/Badge';
import { CardSkeleton } from '../components/ui/Skeleton';
import { pageHeaderImages } from '../lib/stockImages';
import EmptyState from '../components/ui/EmptyState';
import { Link } from 'react-router-dom';
import KidsGallery from '../components/kids/KidsGallery';

const Portfolio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'KIDS_CORNER' | 'ORGANISATION'>('KIDS_CORNER');
  const [orgProjects, setOrgProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgSearchQuery, setOrgSearchQuery] = useState('');

  useEffect(() => {
    const fetchOrgProjects = async () => {
      try {
        const q = query(collection(db, 'portfolio'), where('status', '==', 'PUBLISHED'));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const orgList = docs.filter((p: any) => p.portfolioType === 'CLIENT_WORK' || p.portfolioType === 'ORGANISATION' || !p.portfolioType);
        setOrgProjects(orgList);
      } catch (error) {
        console.error('Error fetching organisation portfolio:', error);
        setOrgProjects([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgProjects();
  }, []);

  // Filter org projects
  const filteredOrgProjects = orgProjects.filter(p => {
    const matchesSearch = !orgSearchQuery || 
      p.title?.toLowerCase().includes(orgSearchQuery.toLowerCase()) || 
      p.client?.toLowerCase().includes(orgSearchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(orgSearchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <MainLayout>
      <SEO 
        title="Portfolio & Kids Corner" 
        description="Explore client platforms, enterprise solutions, and our vibrant Kids Game Zone showcasing young coders' interactive Scratch & web projects." 
      />

      {/* Header Banner */}
      <div className="bg-brand-slate text-white py-16 lg:py-24 relative overflow-hidden">
        <img
          src={pageHeaderImages.portfolio}
          alt=""
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-slate via-brand-slate/85 to-brand-slate/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-slate via-transparent to-brand-slate/20" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
          
          <div className="max-w-3xl mb-12">
            <span className="inline-block text-xs font-black uppercase tracking-widest text-brand-red mb-3">
              Showcase & Interactive Works
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 tracking-tight">
              Our Work & Showcase
            </h1>
            <p className="text-base sm:text-lg text-white/80 leading-relaxed font-normal">
              Explore custom digital platforms built for organizations alongside interactive arcade games engineered by our junior student coders.
            </p>
          </div>

          {/* 3 Interactive Editorial Segment Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Tab 1: Kids Corner & Arcade */}
            <button
              type="button"
              onClick={() => setActiveTab('KIDS_CORNER')}
              className={`text-left p-6 rounded-2xl transition-all duration-300 relative border ${
                activeTab === 'KIDS_CORNER'
                  ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-white'
                  : 'bg-white/[0.04] border-white/10 hover:border-amber-500/30 text-white/80 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${
                  activeTab === 'KIDS_CORNER' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 text-amber-400'
                }`}>
                  <Gamepad2 size={20} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  activeTab === 'KIDS_CORNER' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white/60'
                }`}>
                  {activeTab === 'KIDS_CORNER' ? 'Active Zone' : 'Explore'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <span>Kids Corner & Arcade</span>
                <ChevronRight size={16} className={`transition-transform duration-200 ${activeTab === 'KIDS_CORNER' ? 'text-amber-400 translate-x-0.5' : 'opacity-40'}`} />
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Play real Scratch & web games created by our young tech students with full arcade controls.
              </p>
            </button>

            {/* Tab 2: Organisation Featured Projects */}
            <button
              type="button"
              onClick={() => setActiveTab('ORGANISATION')}
              className={`text-left p-6 rounded-2xl transition-all duration-300 relative border ${
                activeTab === 'ORGANISATION'
                  ? 'bg-brand-red/10 border-brand-red/60 ring-1 ring-brand-red/40 text-white'
                  : 'bg-white/[0.04] border-white/10 hover:border-brand-red/30 text-white/80 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${
                  activeTab === 'ORGANISATION' ? 'bg-brand-red text-white' : 'bg-white/10 text-red-400'
                }`}>
                  <Briefcase size={20} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  activeTab === 'ORGANISATION' ? 'bg-brand-red text-white' : 'bg-white/10 text-white/60'
                }`}>
                  {activeTab === 'ORGANISATION' ? 'Active Case Studies' : 'Explore'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <span>Organisation Solutions</span>
                <ChevronRight size={16} className={`transition-transform duration-200 ${activeTab === 'ORGANISATION' ? 'text-brand-red translate-x-0.5' : 'opacity-40'}`} />
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Enterprise EdTech portals, assessment suites, and hardware workshop toolkits.
              </p>
            </button>

            {/* Tab 3: Magic 3D Particles */}
            <Link
              to="/magic-particles"
              className="p-6 rounded-2xl transition-all duration-300 relative border bg-white/[0.04] hover:bg-cyan-500/10 border-white/10 hover:border-cyan-400/50 text-white/80 hover:text-white block group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-white/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                  <Zap size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                  Interactive Lab
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2 group-hover:text-cyan-300 transition-colors">
                <span>Magic 3D Particles</span>
                <ArrowRight size={16} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Control 5,500+ glowing 3D particles with real-time mouse, touch, and webcam gesture physics.
              </p>
            </Link>

          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="digital-canvas py-16 md:py-24 min-h-[60vh]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">

          {/* TAB 1: KIDS CORNER & INTERACTIVE GAME ZONE */}
          {activeTab === 'KIDS_CORNER' && (
            <KidsGallery showHeroBanner={true} />
          )}

          {/* TAB 2: ORGANISATION FEATURED PROJECTS */}
          {activeTab === 'ORGANISATION' && (
            <div className="space-y-12">
              
              {/* Search Bar for Organisation Projects */}
              <div className="pro-surface flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search organisation projects..."
                    value={orgSearchQuery}
                    onChange={(e) => setOrgSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                  />
                  {orgSearchQuery && (
                    <button onClick={() => setOrgSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  Showing {filteredOrgProjects.length} client & institutional platforms
                </div>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-brand-slate dark:text-white tracking-tight">
                  Organisation & Client Projects ({filteredOrgProjects.length})
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enterprise web platforms, school digital systems, and tech consulting solutions.
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                  {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                </div>
              ) : filteredOrgProjects.length === 0 ? (
                <EmptyState 
                  title="No Organisation Projects Found"
                  description="We are currently curating our case studies. Check back soon or contact us for a demo."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {filteredOrgProjects.map((project, idx) => (
                    <motion.div 
                      key={project.id} 
                      initial={{ opacity: 0, y: 28 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-30px' }}
                      transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
                      className={`${idx % 3 === 0 ? 'lg:col-span-7' : 'lg:col-span-5'} group flex flex-col rounded-[2rem] overflow-hidden pro-surface pro-interactive`}
                    >
                      {project.featuredImage ? (
                        <div className={`${idx % 3 === 0 ? 'h-80' : 'h-64'} w-full relative border-b border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900`}>
                          <img 
                            src={project.featuredImage} 
                            alt={project.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                        </div>
                      ) : (
                        <div className="h-56 bg-brand-slate flex items-center justify-center border-b border-slate-200 dark:border-slate-800 relative p-8">
                          <div className="text-center">
                            <span className="font-extrabold text-white/20 text-5xl tracking-widest uppercase block mb-2 font-mono">
                              {project.title.substring(0, 3)}
                            </span>
                            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
                              {project.category || 'Enterprise Solution'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="p-6 sm:p-8 flex-grow flex flex-col">
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div>
                            <Badge variant="brand" className="mb-2.5">
                              {project.category || 'Client Project'}
                            </Badge>
                            <h3 className="text-xl sm:text-2xl font-extrabold text-brand-slate dark:text-white leading-tight">
                              {project.title}
                            </h3>
                          </div>
                          {project.liveUrl && (
                            <a 
                              href={project.liveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:bg-brand-red hover:text-white transition-colors shrink-0 border border-slate-200 dark:border-slate-800"
                              title="Visit live system"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                        </div>

                        {project.client && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Briefcase size={14} className="text-brand-red" />
                            <span>Client: {project.client}</span>
                          </div>
                        )}

                        <div 
                          className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed font-normal quill-content mb-6 flex-grow" 
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(project.description || '') }} 
                        />

                        {project.liveUrl && (
                          <div className="pt-4 border-t border-slate-200/50 dark:border-white/10">
                            <a
                              href={project.liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider hover:text-red-700 dark:hover:text-red-400"
                            >
                              View Live System <ExternalLink size={14} />
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
};

export default Portfolio;
