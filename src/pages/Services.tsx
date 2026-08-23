import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import MainLayout from '../components/layout/MainLayout';
import SEO from '../components/ui/SEO';
import { Monitor, Paintbrush, Database, Globe, Briefcase, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { stockImages, pageHeaderImages } from '../lib/stockImages';
import { StaggerGroup } from '../components/ui/Reveal';
import PageHeader from '../components/ui/PageHeader';
import { staggerItem } from '../components/ui/animationVariants';
import { motion } from 'motion/react';
import { usePageSection } from '../lib/cms';

const getIconComponent = (iconName: string) => {
  const normalizedName = (iconName || "Monitor").toLowerCase();
  const lowerIcons: Record<string, React.ReactNode> = { 
    monitor: <Monitor size={22} />, 
    database: <Database size={22} />, 
    paintbrush: <Paintbrush size={22} />, 
    briefcase: <Briefcase size={22} />, 
    globe: <Globe size={22} />, 
    cpu: <Cpu size={22} /> 
  };
  return lowerIcons[normalizedName] || <Monitor size={22} />;
};

const getServiceImage = (iconName: string) => {
  const normalizedName = (iconName || "Monitor").toLowerCase();
  const map: Record<string, string> = {
    monitor: stockImages.webDev,
    database: stockImages.database,
    paintbrush: stockImages.design,
    briefcase: stockImages.consulting,
    globe: stockImages.global,
    cpu: stockImages.tech,
  };
  return map[normalizedName] || stockImages.webDev;
};

const Services: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: heroData } = usePageSection('services', 'hero', {
    title: 'SOLUTIONS THAT DELIVER.',
    subtitle: 'From interactive software platforms to enterprise school management systems and branding, we provide end-to-end digital solutions.',
    bannerImage: ''
  });

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(collection(db, 'services'), where('status', '==', 'PUBLISHED'));
        const snapshot = await getDocs(q);
        setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  return (
    <MainLayout>
      <SEO title="Services" description="Professional technology and creative services designed to elevate your brand." />
      <PageHeader
        eyebrow="What We Offer"
        title={heroData.title || 'SOLUTIONS THAT DELIVER.'}
        description={heroData.subtitle || 'From interactive software platforms to enterprise school management systems and branding, we provide end-to-end digital solutions.'}
        image={heroData.bannerImage}
        fallbackImage={pageHeaderImages.services}
      />
      
      <div className="py-24 bg-brand-neutral dark:bg-slate-900 dark:border-slate-800 min-h-[50vh]">
        <div className="container mx-auto px-4 max-w-7xl">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : services.length === 0 ? (
            <EmptyState 
              title="No Services Found" 
              description="We are currently updating our professional services catalog. Please check back soon."
            />
          ) : (
            <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service) => (
                <motion.div 
                  key={service.id} 
                  variants={staggerItem}
                  whileHover={{ y: -6, transition: { duration: 0.28, ease: 'easeOut' } }}
                >
                  <Link
                    to={`/services/${service.slug}`}
                    className="group relative flex flex-col justify-end h-[340px] rounded-2xl overflow-hidden glass-card hover:border-cyan-400/50 transition-all duration-300"
                  >
                    <img
                      src={getServiceImage(service.iconName)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-slate via-brand-slate/85 to-brand-slate/20" />
                    <div className="relative z-10 p-6 sm:p-8">
                      <div className="w-12 h-12 shrink-0 aspect-square bg-white/15 backdrop-blur-md border border-white/25 rounded-xl flex items-center justify-center mb-5 text-white group-hover:bg-cyan-500/20 group-hover:border-cyan-400/50 group-hover:text-cyan-300 transition-all shadow-sm">
                        {getIconComponent(service.iconName)}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{service.title}</h3>
                      <p className="text-white/80 leading-relaxed mb-4 text-sm line-clamp-2">
                        {service.shortDescription}
                      </p>
                      <span className="font-bold text-xs uppercase tracking-wider text-cyan-400 group-hover:text-white inline-flex items-center gap-1.5 transition-colors">
                        Learn More
                        <span className="transition-transform group-hover:translate-x-1.5">&rarr;</span>
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </StaggerGroup>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Services;
