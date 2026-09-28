import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, School, GraduationCap, User } from 'lucide-react';
import { getActiveImpersonation, stopImpersonation } from '../../utils/impersonation';

export const AdminImpersonationBanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [impersonation, setImpersonation] = useState<any>(null);

  useEffect(() => {
    const check = () => {
      const active = getActiveImpersonation();
      setImpersonation(active && active.isMasquerading ? active : null);
    };

    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, [location.pathname]);

  if (!impersonation) {
    return null;
  }

  const target = impersonation.targetUser || {};
  const targetRole = String(impersonation.targetRole || 'STUDENT').toUpperCase();
  const targetName = target.name || target.fullName || target.email?.split('@')[0] || 'User';
  const targetSchool = target.schoolName || sessionStorage.getItem('studentSchoolName') || '';
  const targetClass = target.class || target.classLevel || sessionStorage.getItem('studentClass') || '';

  const handleExit = () => {
    stopImpersonation(navigate);
  };

  return (
    <div className="relative z-[9999] w-full bg-gradient-to-r from-amber-600 via-amber-500 to-red-600 text-white px-4 py-2 text-xs shadow-md border-b border-amber-700/50 flex flex-wrap items-center justify-between gap-3 font-sans">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-black/30 font-black uppercase text-[10px] tracking-wider shrink-0 border border-white/20">
          <ShieldCheck size={13} className="text-amber-200" />
          Admin Impersonation Mode Active
        </span>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/95 font-semibold truncate">
          <span className="inline-flex items-center gap-1">
            <User size={12} className="opacity-75" />
            Viewing as: <strong className="text-white font-black">{targetName}</strong>
          </span>
          <span className="opacity-75">({targetRole})</span>

          {targetSchool && (
            <span className="hidden md:inline-flex items-center gap-1 pl-1 border-l border-white/20">
              <School size={12} className="opacity-75" />
              <span>{targetSchool}</span>
            </span>
          )}

          {targetClass && (
            <span className="hidden sm:inline-flex items-center gap-1 pl-1 border-l border-white/20">
              <GraduationCap size={12} className="opacity-75" />
              <span>Class: <strong>{targetClass}</strong></span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/80 hover:bg-black text-white font-black text-xs shadow-sm transition hover:scale-105 active:scale-95 border border-white/20"
        >
          <LogOut size={13} className="text-red-300" />
          Exit &amp; Return to Admin
        </button>
      </div>
    </div>
  );
};

export default AdminImpersonationBanner;
