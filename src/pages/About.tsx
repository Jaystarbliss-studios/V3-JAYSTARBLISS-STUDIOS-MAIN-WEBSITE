import React from 'react';
import MainLayout from '../components/layout/MainLayout';
import Button from '../components/ui/Button';
import SEO from '../components/ui/SEO';
import PageHeader from '../components/ui/PageHeader';
import { pageHeaderImages } from '../lib/stockImages';
import { usePageSection } from '../lib/cms';
import { motion } from 'motion/react';

const About: React.FC = () => {
  const { data: heroData } = usePageSection('about', 'hero', {
    title: 'WE TEACH. WE BUILD. WE CREATE.',
    paragraph1: "Jaystarbliss Studios is a learning, technology and creative company built around a simple idea: people learn better when they get the opportunity to actually use what they're learning.",
    paragraph2: "What started from a focus on teaching has grown into a broader ecosystem where education, technology and creativity meet.",
    paragraph3: "Today, Jaystarbliss Studios supports students, families, schools and businesses through practical learning programs, digital services and creative work.",
    bannerImage: ''
  });

  const { data: beliefsData } = usePageSection('about', 'beliefs', {
    sectionTitle: 'WHAT WE BELIEVE',
    sectionSubtitle: 'The foundational principles that guide how we teach, engineer solutions, and collaborate with our community.',
    b1Title: 'PRACTICAL SKILLS MATTER',
    b1Desc: 'Learning should prepare people to do something, not simply remember something.',
    b2Title: 'CREATIVITY MATTERS',
    b2Desc: 'Technology is powerful, but creativity is what helps people use it in meaningful ways.',
    b3Title: 'GOOD WORK TAKES CARE',
    b3Desc: "Whether we're teaching a student or building a website for a client, we believe the details matter.",
    b4Title: 'PEOPLE COME FIRST',
    b4Desc: 'Every student, parent, school and client has different needs. We listen before we recommend.'
  });

  const beliefs = [
    {
      num: "01",
      title: beliefsData.b1Title || "PRACTICAL SKILLS MATTER",
      desc: beliefsData.b1Desc || "Learning should prepare people to do something, not simply remember something."
    },
    {
      num: "02",
      title: beliefsData.b2Title || "CREATIVITY MATTERS",
      desc: beliefsData.b2Desc || "Technology is powerful, but creativity is what helps people use it in meaningful ways."
    },
    {
      num: "03",
      title: beliefsData.b3Title || "GOOD WORK TAKES CARE",
      desc: beliefsData.b3Desc || "Whether we're teaching a student or building a website for a client, we believe the details matter."
    },
    {
      num: "04",
      title: beliefsData.b4Title || "PEOPLE COME FIRST",
      desc: beliefsData.b4Desc || "Every student, parent, school and client has different needs. We listen before we recommend."
    }
  ];

  return (
    <MainLayout>
      <SEO 
        title="About Us" 
        description="Jaystarbliss Studios is a learning, technology and creative company built around practical education, digital services, and creative solutions."
      />

      {/* Hero Header */}
      <PageHeader
        eyebrow="About Jaystarbliss Studios"
        title={heroData.title || 'WE TEACH. WE BUILD. WE CREATE.'}
        image={heroData.bannerImage}
        fallbackImage={pageHeaderImages.about}
        size="lg"
        description={
          <span className="block space-y-4 border-l-2 border-brand-red pl-6">
            {heroData.paragraph1 && <span className="block">{heroData.paragraph1}</span>}
            {heroData.paragraph2 && <span className="block">{heroData.paragraph2}</span>}
            {heroData.paragraph3 && <span className="block">{heroData.paragraph3}</span>}
          </span>
        }
      />

      {/* What We Believe - Clean Editorial Rows */}
      <div className="py-20 lg:py-28 bg-brand-neutral dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <span className="text-xs font-black uppercase tracking-widest text-brand-red block mb-2">Core Philosophy</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-slate dark:text-white tracking-tight">
                {beliefsData.sectionTitle || 'WHAT WE BELIEVE'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
                {beliefsData.sectionSubtitle || 'The foundational principles that guide how we teach, engineer solutions, and collaborate with our community.'}
              </p>
            </div>

            <div className="lg:col-span-8 divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
              {beliefs.map((b) => (
                <div key={b.num} className="py-8 sm:py-10 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6 items-baseline group">
                  <div className="sm:col-span-2 font-mono text-2xl font-extrabold text-slate-400 dark:text-slate-600 group-hover:text-brand-red transition-colors">
                    {b.num}
                  </div>
                  <div className="sm:col-span-10 space-y-2">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-brand-slate dark:text-white group-hover:text-brand-red transition-colors">
                      {b.title}
                    </h3>
                    <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                      {b.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Our Approach - Full-width Editorial Section */}
      <div className="py-20 lg:py-28 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-brand-red block mb-2">Tailored Execution</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-slate dark:text-white tracking-tight">
              OUR APPROACH
            </h2>
          </div>
          <div className="space-y-6 text-lg sm:text-xl text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-slate dark:text-white leading-snug">
              We don't believe in forcing everyone into the same solution.
            </p>
            <p>
              A five-year-old learning Scratch needs a different experience from a business owner launching a website. A school needs something different from a graphic design client.
            </p>
            <p>
              That's why our approach starts with understanding the person, the goal and the situation — then building the right path from there.
            </p>
          </div>
        </div>
      </div>

      {/* Vision & Mission - Split Editorial Panel */}
      <div className="py-20 lg:py-28 bg-brand-slate text-white border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            
            <motion.div 
              whileHover={{ y: -6, transition: { duration: 0.28, ease: 'easeOut' } }}
              className="p-6 sm:p-12 rounded-2xl glass-card bg-white/10 backdrop-blur-md border border-white/20 hover:border-cyan-400/50 hover:bg-white/15 transition-all duration-300 relative overflow-hidden shadow-lg"
            >
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400 block mb-4">Direction</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-white tracking-tight">
                OUR VISION
              </h2>
              <p className="text-base sm:text-lg text-white/80 leading-relaxed font-normal">
                To build a company where education, technology and creativity work together to give people practical skills, useful digital tools and better opportunities to create.
              </p>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -6, transition: { duration: 0.28, ease: 'easeOut' } }}
              className="p-6 sm:p-12 rounded-2xl glass-card bg-white/10 backdrop-blur-md border border-white/20 hover:border-cyan-400/50 hover:bg-white/15 transition-all duration-300 relative overflow-hidden shadow-lg"
            >
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400 block mb-4">Commitment</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-white tracking-tight">
                OUR MISSION
              </h2>
              <p className="text-base sm:text-lg text-white/80 leading-relaxed font-normal">
                To provide practical education, reliable digital solutions and thoughtful creative services that help individuals and organizations learn, build and grow.
              </p>
            </motion.div>

          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-20 lg:py-24 bg-brand-neutral dark:bg-slate-900 text-center border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-slate dark:text-white mb-8 tracking-tight">
            READY TO WORK WITH US?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Button to="/programs" size="lg" className="shadow-lg shadow-brand-red/20">
              START LEARNING
            </Button>
            <Button to="/contact" variant="secondary" size="lg" className="shadow-lg">
              GET IN TOUCH
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default About;
