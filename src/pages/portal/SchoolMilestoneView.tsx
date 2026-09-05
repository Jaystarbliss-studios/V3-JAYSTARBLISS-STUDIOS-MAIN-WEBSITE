import React, { useEffect, useState } from 'react';
import MilestoneCenter from './MilestoneCenter';

const SchoolMilestoneView: React.FC = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = async () => {
      try {
        const user = (await import('../../lib/firebase')).auth.currentUser;
        if (user) {
          const token = await user.getIdToken();
          const response = await fetch('/api/academic-schools', { headers: { Authorization: `Bearer ${token}` } });
          const data = await response.json();
          const school = data.schools?.[0];
          if (school?.id) sessionStorage.setItem('schoolDocId', school.id);
        }
      } catch (error) { console.warn('Could not resolve school milestone target.', error); }
      finally { setReady(true); }
    };
    void load();
  }, []);
  if (!ready) return <div className="py-12 flex justify-center text-sm text-slate-500">Loading school learning plan…</div>;
  return <MilestoneCenter role="school" />;
};
export default SchoolMilestoneView;
