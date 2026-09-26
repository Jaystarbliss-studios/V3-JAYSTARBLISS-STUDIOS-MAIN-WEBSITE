import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, LogOut, LayoutDashboard, CreditCard, Moon, Sun, Menu, X,
  Radio, Trophy, GraduationCap, ClipboardCheck, CalendarDays, KeyRound,
  Users, ShieldCheck, FileCheck2, Library, SlidersHorizontal, WalletCards,
  ExternalLink, Award
} from 'lucide-react';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Tooltip } from '../ui/Tooltip';
import { JaystarblissIcon } from '../common/JaystarblissLogo';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationBell from '../common/NotificationBell';
import SEO from '../ui/SEO';

type NavItem = { name: string; path: string; icon: React.ReactNode; desc: string };

const PortalLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const role = location.pathname.split('/')[2] || 'student';

  const [displayName, setDisplayName] = useState('Portal User');
  const [userEmail, setUserEmail] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    setUserEmail(user?.email || '');
    setIsEmailVerified(user?.emailVerified ?? true);
    setPhotoURL(user?.photoURL || null);
    setDisplayName(
      sessionStorage.getItem('userName') ||
      user?.displayName ||
      user?.email?.split('@')[0] ||
      'Portal User'
    );
  }, [location.pathname]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSidebarExpanded(false);
  }, [location.pathname]);

  const logout = async () => {
    await signOut(auth).catch(() => undefined);
    sessionStorage.clear();
    navigate('/portal');
  };

  const resendVerification = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setResendingVerification(true);
    try {
      await sendEmailVerification(user);
      toast.success(`Verification link sent to ${user.email}.`);
    } catch (error: any) {
      toast.error(error?.code === 'auth/too-many-requests' ? 'Please wait before requesting another link.' : 'Unable to send verification email.');
    } finally {
      setResendingVerification(false);
    }
  };

  const navLinks: NavItem[] = (() => {
    const items: NavItem[] = [
      { name: 'Dashboard', path: `/portal/${role}`, icon: <LayoutDashboard size={18} />, desc: 'Portal Overview' }
    ];
    if (role === 'student') {
      items.push(
        { name: 'Learning & Tracks', path: '/portal/student/courses', icon: <GraduationCap size={18} />, desc: 'Curriculum & Series' },
        { name: 'Class Schedules', path: '/portal/student/calendar', icon: <CalendarDays size={18} />, desc: 'Programme timetable & class status' },
        { name: 'Live Classrooms', path: '/portal/student/live-classrooms', icon: <Radio size={18} />, desc: 'Live lessons & sessions' },
        { name: 'Achievements & Badges', path: '/portal/student/achievements', icon: <Trophy size={18} />, desc: 'Mastery, badges & certificates' },
        { name: 'Lesson Resources', path: '/portal/student/resources', icon: <BookOpen size={18} />, desc: 'Lesson notes & materials' },
        { name: 'Assessments & Quizzes', path: '/portal/student/assessments', icon: <ClipboardCheck size={18} />, desc: 'CBT assessments & quizzes' }
      );
      if (sessionStorage.getItem('studentRegistrationType') === 'individual') {
        items.push({ name: 'Payments & Fees', path: '/portal/student/payments', icon: <CreditCard size={18} />, desc: 'Personal billing & statements' });
      }
    } else if (role === 'staff') {
      items.push(
        { name: 'Live Classes', path: '/portal/staff/classes', icon: <Radio size={18} />, desc: 'Teaching roster' },
        { name: 'Student Access', path: '/portal/staff/credentials', icon: <KeyRound size={18} />, desc: 'Access credentials' },
        { name: 'Lesson Resources', path: '/portal/staff/resources', icon: <BookOpen size={18} />, desc: 'Lesson materials' },
        { name: 'Subjects I Teach', path: '/portal/staff/subjects', icon: <Award size={18} />, desc: 'Teaching subjects & approvals' },
        { name: 'Calendar', path: '/portal/staff/calendar', icon: <CalendarDays size={18} />, desc: 'Teaching timetable' },
        { name: 'Billing / Fees', path: '/portal/staff/payments', icon: <WalletCards size={18} />, desc: 'Tutor ledger & payouts' }
      );
    } else if (role === 'parent') {
      items.push(
        { name: 'Calendar', path: '/portal/parent/calendar', icon: <CalendarDays size={18} />, desc: 'Class timetable' },
        { name: 'Resources', path: '/portal/parent/resources', icon: <BookOpen size={18} />, desc: 'Learning materials' },
        { name: 'Payments & Fees', path: '/portal/parent/payments', icon: <CreditCard size={18} />, desc: 'Invoices & statements' }
      );
    } else if (role === 'school') {
      items.push(
        { name: 'Learners Roster', path: '/portal/school/roster', icon: <Users size={18} />, desc: 'Student records' },
        { name: 'Student Access', path: '/portal/school/credentials', icon: <KeyRound size={18} />, desc: 'Student access packs' },
        { name: 'Class Schedules', path: '/portal/school/schedules', icon: <CalendarDays size={18} />, desc: 'Classes & attendance' },
        { name: 'Exam Passcodes', path: '/portal/school/passcodes', icon: <ShieldCheck size={18} />, desc: 'Active assessment keys' },
        { name: 'CBT Assessments', path: '/portal/school/exams', icon: <FileCheck2 size={18} />, desc: 'Student exams' },
        { name: 'Institutional Resources', path: '/portal/school/resources', icon: <Library size={18} />, desc: 'School learning materials' },
        { name: 'Fees & Payments', path: '/portal/school/payments', icon: <CreditCard size={18} />, desc: 'School fees & payments' }
      );
    }
    items.push({ name: 'Settings', path: `/portal/${role}/settings`, icon: <SlidersHorizontal size={18} />, desc: 'Account preferences' });
    return items;
  })();

  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const accessCodeOnly = !userEmail && Boolean(sessionStorage.getItem('studentDocId'));

  const NavLink = ({ item, mobile = false }: { item: NavItem; mobile?: boolean }) => {
    const active = location.pathname === item.path;
    return (
      <Tooltip content={!mobile && !sidebarExpanded ? `${item.name} • ${item.desc}` : item.desc} placement="right" delay={200}>
        <Link
          to={item.path}
          onClick={() => mobile && setMobileMenuOpen(false)}
          className={`group w-full box-border grid grid-cols-[32px_minmax(0,1fr)] items-center h-10 px-2.5 rounded-xl transition-colors text-xs font-semibold whitespace-nowrap overflow-hidden ${
            active ? 'bg-brand-red text-white shadow-sm font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="w-8 h-8 flex items-center justify-center shrink-0">{item.icon}</span>
          <span className={`min-w-0 overflow-hidden text-ellipsis pl-2 ${mobile ? '' : sidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {item.name}
          </span>
        </Link>
      </Tooltip>
    );
  };

  return (
    <div className="h-screen w-full bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      <SEO title={`${roleTitle} Portal | Jaystarbliss Studios`} description={`Jaystarbliss Studios ${roleTitle} portal.`} noindex />

      <div className="md:hidden bg-[#0F1117] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-white/10 shrink-0">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <JaystarblissIcon className="w-7 h-7 shrink-0" />
          <span className="font-bold text-xs uppercase whitespace-nowrap">JAYSTARBLISS</span>
          <span className="text-[10px] uppercase font-bold bg-brand-red px-2 py-0.5 rounded text-white">{role}</span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell role={role} />
          <button type="button" onClick={toggleTheme} className="p-2 rounded-xl bg-white/10 text-slate-300" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-xl bg-white/10 text-white" aria-label="Open menu"><Menu size={20} /></button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <motion.button aria-label="Close menu" className="absolute inset-0 bg-black/65" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="absolute inset-y-0 left-0 w-[72vw] max-w-[300px] bg-[#0F1117] text-white border-r border-white/10 shadow-2xl flex flex-col p-3 overflow-y-auto"
            >
              <div className="flex items-center justify-between h-12 px-1 border-b border-white/10 shrink-0">
                <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2"><JaystarblissIcon className="w-6 h-6" /><span className="text-xs font-bold">JAYSTARBLISS</span></Link>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg bg-white/10"><X size={18} /></button>
              </div>
              <div className="px-3 py-2.5 my-3 bg-white/5 rounded-2xl flex items-center gap-3 shrink-0">
                {photoURL ? <img src={photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-brand-red/40" referrerPolicy="no-referrer" /> : <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center text-xs font-bold">{displayName.charAt(0)}</div>}
                <div className="min-w-0"><p className="text-xs font-bold truncate">{displayName}</p><p className="text-[10px] text-slate-400 truncate">{userEmail || `${role} portal`}</p></div>
              </div>
              <nav className="space-y-1">
                {navLinks.map(item => <NavLink key={item.name} item={item} mobile />)}
              </nav>
              <button type="button" onClick={logout} className="mt-auto pt-3 border-t border-white/10 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/80 text-white text-xs font-bold"><LogOut size={14} /> Log Out</button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: sidebarExpanded ? 260 : 80 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className="hidden md:flex bg-[#0F1117] text-white flex-col h-full border-r border-slate-800/80 shrink-0 select-none overflow-hidden"
      >
        <div className="h-16 px-3 border-b border-slate-800/80 flex items-center shrink-0 overflow-hidden">
          <Tooltip content="Return to Main Website" placement="right">
            <Link to="/" className="grid grid-cols-[40px_minmax(0,1fr)] items-center w-full h-full overflow-hidden">
              <span className="w-10 h-10 flex items-center justify-center shrink-0"><JaystarblissIcon className="w-8 h-8" /></span>
              <motion.span animate={{ opacity: sidebarExpanded ? 1 : 0 }} transition={{ duration: 0.15 }} className="min-w-0 pl-2 whitespace-nowrap overflow-hidden">
                <span className="block text-sm font-bold">JAYSTARBLISS <ExternalLink size={11} className="inline opacity-50" /></span>
                <span className="block text-[10px] text-brand-red font-mono uppercase font-bold">{role} Workspace</span>
              </motion.span>
            </Link>
          </Tooltip>
        </div>

        <nav className="flex-1 px-2.5 py-3 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-1">
          {navLinks.map(item => <NavLink key={item.name} item={item} />)}
        </nav>

        <div className="p-2.5 border-t border-slate-800/80 shrink-0 space-y-1">
          <Tooltip content="Toggle Theme" placement="right">
            <button type="button" onClick={toggleTheme} className="w-full grid grid-cols-[32px_minmax(0,1fr)] items-center h-10 px-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold overflow-hidden">
              <span className="w-8 h-8 flex items-center justify-center shrink-0">{theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}</span>
              <span className={`pl-2 whitespace-nowrap ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Appearance</span>
            </button>
          </Tooltip>
          <Tooltip content="Sign Out" placement="right">
            <button type="button" onClick={logout} className="w-full grid grid-cols-[32px_minmax(0,1fr)] items-center h-10 px-2.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-xs font-semibold overflow-hidden">
              <span className="w-8 h-8 flex items-center justify-center shrink-0"><LogOut size={15} /></span>
              <span className={`pl-2 whitespace-nowrap ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Log Out</span>
            </button>
          </Tooltip>
        </div>
      </motion.aside>

      <main className="flex-1 h-full min-w-0 flex flex-col overflow-y-auto custom-scrollbar pb-16 md:pb-0 bg-[#F8FAFC] dark:bg-[#0B0F17]">
        {!isEmailVerified && !accessCodeOnly && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <span className="truncate">Your email address ({userEmail}) is unverified.</span>
            <button type="button" onClick={resendVerification} disabled={resendingVerification} className="underline font-bold shrink-0">{resendingVerification ? 'Sending…' : 'Resend Link'}</button>
          </div>
        )}

        <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-white/80 dark:bg-[#0c1220]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 shrink-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{roleTitle} Workspace</h2>
          <div className="flex items-center gap-3">
            <NotificationBell role={role} />
            <div className="relative" ref={profileRef}>
              <button type="button" onClick={() => setShowProfileMenu(v => !v)} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="User profile menu">
                {photoURL ? <img src={photoURL} alt={displayName} className="w-8 h-8 rounded-full object-cover border border-brand-red/50" referrerPolicy="no-referrer" /> : <div className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs">{displayName.charAt(0)}</div>}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{displayName}</span>
              </button>
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 text-xs font-semibold">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800"><p className="font-bold truncate">{displayName}</p><p className="text-[11px] text-slate-500 truncate">{userEmail || `${role} account`}</p></div>
                    <Link to={`/portal/${role}/settings`} onClick={() => setShowProfileMenu(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"><SlidersHorizontal size={14} /> Account Settings</Link>
                    <button type="button" onClick={() => { setShowProfileMenu(false); setShowPasswordModal(true); }} className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"><KeyRound size={14} /> Change Password</button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button type="button" onClick={logout} className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-brand-red text-left font-bold"><LogOut size={14} /> Sign Out</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0F1117]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-2 py-1.5 flex items-center overflow-x-auto no-scrollbar gap-1 z-30 shadow-lg">
        {navLinks.map(item => {
          const active = location.pathname === item.path;
          return <Link key={item.name} to={item.path} className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl shrink-0 min-w-[62px] ${active ? 'text-brand-red font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{item.icon}<span className="text-[9px] mt-0.5 truncate max-w-[65px]">{item.name}</span></Link>;
        })}
      </div>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
};

export default PortalLayout;
