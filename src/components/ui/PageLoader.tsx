import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PageLoader: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setVisible(true);
    setProgress(10);
    
    const timer1 = setTimeout(() => setProgress(40), 100);
    const timer2 = setTimeout(() => setProgress(80), 300);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => setProgress(0), 200); // reset after fade out
      }, 300);
    }, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
      <div 
        className="h-full bg-brand-red transition-all duration-300 ease-out shadow-[0_0_10px_rgba(185,28,28,0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default PageLoader;
