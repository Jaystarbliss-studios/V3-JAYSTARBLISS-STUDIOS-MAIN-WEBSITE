import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  CreditCard, 
  Moon, 
  Sun, 
  Menu, 
  X, 
  Video, 
  Radio,
  Award,
  Trophy,
  GraduationCap,
  ClipboardCheck,
  CalendarDays,
  KeyRound,
  Users,
  ShieldCheck,
  FileCheck2,
  Library,
  SlidersHorizontal,
  WalletCards,
  ExternalLink
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

const PortalLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  
  const pathParts = location.pathname.split('/');
  const role = pathParts[2] || 'student';
  
  const [displayName, setDisplayName] = useState('Student');
  const [userEmail, setUserEmail] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email || '');
      setIsEmailVerified(user.emailVerified);
      setPhotoURL(user.photoURL);
      setDisplayName(sessionStorage.getItem('userName') || user.displayName || user.email?.split('@')[0] || 'Student');
    } else {
      setDisplayName(sessionStorage.getItem('userName') || 'Portal User');
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    sessionStorage.clear();
    navigate('/portal');
  };

  const handleResendEmail = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setResendingVerification(true);
    try {
      await sendEmailVerification(user);
      toast.success(`Verification link sent to ${user.email}! Please check your email.`);
    } catch (err: any) {
      toast.error(err.code === 'auth/too-many-requests' ? 'Too many requests. Please wait a moment.' : 'Failed to send email verification.');
    } finally {
      setResendingVerification(false);
    }
  };

  const getNavLinks = () => {
    const base = [
      { name: 'Dashboard', path: `/portal/${role}`, icon: <LayoutDashboard size={18} />, desc: 'Portal Overview' },
    ];
    if (role === 'student') {
      base.push({ name: 'Learning & Tracks', path: '/portal/student/courses', icon: <GraduationCap size={18} />, desc: 'Curriculum & Series' });
      base.push({ name: 'Live Classrooms', path: '/portal/student/live-classrooms', icon: <Radio size={18} />, desc: 'Live lessons & sessions' });
      base.push({ name: 'Achievements & Badges', path: '/portal/student/achievements', icon: <Trophy size={18} />, desc: 'Mastery, badges & certificates' });
      base.push({ name: 'Lesson Resources', path: '/portal/student/resources', icon: <BookOpen size={18} />, desc: 'Lesson Notes & Materials' });
      base.push({ name: 'Assessments & Quizzes', path: '/portal/student/assessments', icon: <ClipboardCheck size={18} />, desc: 'CBT assessments & quizzes' });
      const registrationType = sessionStorage.getItem('studentRegistrationType');
      if (registrationType === 'individual') {
        base.push({ name: 'Payments & Fees', path: '/portal/student/payments', icon: <CreditCard size={18} />, desc: 'Personal billing & statements' });
      }
    } else if (role === 'staff') {
      base.push({ name: 'Live Classes', path: '/portal/staff/classes', icon: <Radio size={18} />, desc: 'Teaching Roster' });
      base.push({ name: 'Student Access', path: '/portal/staff/credentials', icon: <KeyRound size={18} />, desc: 'Access Credentials' });
      base.push({ name: 'Lesson Resources', path: '/portal/staff/resources', icon: <BookOpen size={18} />, desc: 'Lesson Materials' }); 
      base.push({ name: 'Subjects I Teach', path: '/portal/staff/subjects', icon: <Award size={18} />, desc: 'Teaching Subjects & Approvals' });
      base.push({ name: 'Calendar', path: '/portal/staff/calendar', icon: <CalendarDays size={18} />, desc: 'Teaching Timetable' });
      base.push({ name: 'Billing / Fees', path: '/portal/staff/payments', icon: <WalletCards size={18} />, desc: 'Tutor Ledger & Payouts' });
    } else if (role === 'parent') {
      base.push({ name: 'Calendar', path: '/portal/parent/calendar', icon: <CalendarDays size={18} />, desc: 'Class Timetable' });
      base.push({ name: 'Resources', path: '/portal/parent/resources', icon: <BookOpen size={18} />, desc: 'Learning Materials' });
      base.push({ name: 'Payments & Fees', path: '/portal/parent/payments', icon: <CreditCard size={18} />, desc: 'Invoices & Statements' });
    } else if (role === 'school') {
      base.push({ name: 'Learners Roster', path: '/portal/school/roster', icon: <Users size={18} />, desc: 'Student Records' });
      base.push({ name: 'Student Access', path: '/portal/school/credentials', icon: <KeyRound size={18} />, desc: 'Student Access Packs' });
      base.push({ name: 'Class Schedules', path: '/portal/school/schedules', icon: <CalendarDays size={18} />, desc: 'Classes & Attendance' });
      base.push({ name: 'Exam Passcodes', path: '/portal/school/passcodes', icon: <ShieldCheck size={18} />, desc: 'Active Assessment Keys' });
      base.push({ name: 'CBT Assessments', path: '/portal/school/exams', icon: <FileCheck2 size={18} />, desc: 'Student Exams' });
      base.push({ name: 'Institutional Resources', path: '/portal/school/resources', icon: <Library size={18} />, desc: 'School Learning Materials' });
      base.push({ name: 'Fees & Payments', path: '/portal/school/payments', icon: <CreditCard size={18} />, desc: 'School Fees & Payments' });
    }
    base.push({ name: 'Settings', path: `/portal/${role}/settings`, icon: <SlidersHorizontal size={18} />, desc: 'Account Preferences' });
    return base;
  };

  const navLinks = getNavLinks();
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const isStudentAccessCodeOnly = !userEmail && sessionStorage.getItem('studentDocId');

  return (
    <div className="h-screen w-full bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      <SEO 
        title={`${roleTitle} Portal | Jaystarbliss Studios`} 
        description={`Jaystarbliss Studios ${roleTitle} portal access and learning dashboard.`} 
        noindex={true} 
      />

      {/* Top Mobile Bar */}
      <div className="md:hidden bg-[#0F1117] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md shrink-0 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <JaystarblissIcon className="w-7 h-7 shrink-0" />
          <span className="font-bold text-xs tracking-tight uppercase whitespace-nowrap">JAYSTARBLISS</span>
          <span className="text-[10px] uppercase font-bold bg-brand-red px-2 py-0.5 rounded text-white">{role}</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell role={role} />
          <button 
            type="button" 
            onClick={toggleTheme} 
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>
          <button 
            type="button" 
            onClick={() => setMobileMenuOpen(true)} 
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white" 
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer (Opens from LEFT, Occupies ~70% screen width, dim backdrop, click outside to close) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            />

            {/* Side Drawer from Left */}
            <motion.div 
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }} 
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="fixed inset-y-0 left-0 w-[72vw] max-w-[290px] bg-[#0F1117] text-white p-4 space-y-4 shadow-2xl border-r border-white/10 flex flex-col justify-between overflow-y-auto custom-scrollbar"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                    <JaystarblissIcon className="w-6 h-6 shrink-0" />
                    <span className="font-bold text-xs tracking-tight uppercase">JAYSTARBLISS</span>
                  </Link>
                  <button 
                    type="button" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg bg-white/10 text-slate-300 hover:text-white"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Profile pill */}
                <div className="px-3 py-2 my-3 bg-white/5 rounded-2xl flex items-center gap-3">
                  {photoURL ? (
                    <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border border-brand-red/40" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {displayName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate text-white">{displayName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{userEmail || `${role} portal`}</p>
                  </div>
                </div>

                {/* Navigation links */}
                <nav className="space-y-1">
                  {navLinks.map(link => {
                    const isActive = location.pathname === link.path;
                    return (
                      <Link 
                        key={link.name} 
                        to={link.path} 
                        onClick={() => setMobileMenuOpen(false)} 
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                          isActive 
                            ? 'bg-brand-red text-white shadow-xs font-bold' 
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="shrink-0">{link.icon}</span>
                        <span className="truncate">{link.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Logout at bottom of side menu */}
              <div className="pt-3 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={handleLogout} 
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold transition-colors"
                >
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar: Framer Motion fluid Chrome-style hover expansion (w-20 -> w-64) */}
      <motion.aside 
        initial={false}
        animate={{ width: isHovered ? 260 : 80 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32, mass: 0.8 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="hidden md:flex bg-[#0F1117] text-white flex-col h-full max-h-screen border-r border-slate-800/80 shrink-0 select-none overflow-hidden"
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center shrink-0 overflow-hidden">
          <Tooltip content="Return to Main Website" placement="right">
            <Link to="/" className="flex items-center gap-3 group w-full">
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <JaystarblissIcon className="w-8 h-8 group-hover:scale-105 transition-transform shrink-0" />
              </div>
              <motion.div 
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col min-w-0 whitespace-nowrap ${isHovered ? 'pointer-events-auto' : 'pointer-events-none'}`}
              >
                <span className="font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 text-white">
                  JAYSTARBLISS
                  <ExternalLink size={12} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                </span>
                <span className="text-[10px] text-brand-red font-mono uppercase font-bold">{role} Workspace</span>
              </motion.div>
            </Link>
          </Tooltip>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto custom-scrollbar space-y-1 overflow-x-hidden">
          {navLinks.map(link => {
            const isActive = location.pathname === link.path;
            return (
              <Tooltip key={link.name} content={!isHovered ? `${link.name} • ${link.desc}` : link.desc} placement="right" delay={200}>
                <Link 
                  to={link.path} 
                  className={`flex items-center h-10 px-2 rounded-xl transition-colors text-xs font-semibold ${
                    isActive 
                      ? 'bg-brand-red text-white shadow-xs font-bold' 
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {link.icon}
                  </div>
                  <motion.span 
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.15 }}
                    className={`truncate pl-2 whitespace-nowrap ${
                      isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                    }`}
                  >
                    {link.name}
                  </motion.span>
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-1 overflow-hidden">
          <Tooltip content="Toggle Theme" placement={!isHovered ? 'right' : 'top'}>
            <button 
              type="button" 
              onClick={toggleTheme} 
              className="w-full flex items-center h-10 px-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs font-semibold cursor-pointer" 
              aria-label="Toggle Theme"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
              </div>
              <motion.span 
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                className={`truncate pl-2 whitespace-nowrap ${
                  isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              >
                Appearance
              </motion.span>
            </button>
          </Tooltip>

          <Tooltip content="Sign Out" placement={!isHovered ? 'right' : 'top'}>
            <button 
              type="button" 
              onClick={handleLogout} 
              className="w-full flex items-center h-10 px-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-white/5 transition-colors text-xs font-semibold cursor-pointer" 
              aria-label="Log Out"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <LogOut size={15} />
              </div>
              <motion.span 
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                className={`truncate pl-2 whitespace-nowrap ${
                  isHovered ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              >
                Log Out
              </motion.span>
            </button>
          </Tooltip>
        </div>
      </motion.aside>

      {/* Main Content Workspace */}
      <main className="flex-1 h-full max-h-screen flex flex-col min-w-0 bg-[#F8FAFC] dark:bg-[#0B0F17] overflow-y-auto custom-scrollbar pb-16 md:pb-0">
        {/* Verification banner if email is unverified */}
        {!isEmailVerified && !isStudentAccessCodeOnly && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs shrink-0">
            <span>Your email address ({userEmail}) is unverified. Please verify your email to secure your account.</span>
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendingVerification}
              className="underline font-bold hover:text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {resendingVerification ? 'Sending link...' : 'Resend Link'}
            </button>
          </div>
        )}

        {/* Top Header Bar for Desktop */}
        <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-white/80 dark:bg-[#0c1220]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {roleTitle} Workspace
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell role={role} />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="User profile menu"
              >
                {photoURL ? (
                  <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border border-brand-red/50" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs">
                    {displayName.charAt(0)}
                  </div>
                )}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{displayName}</span>
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 text-xs font-semibold"
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{userEmail || `${role} account`}</p>
                    </div>

                    <Link
                      to={`/portal/${role}/settings`}
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <SlidersHorizontal size={14} />
                      <span>Account Settings</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowPasswordModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-left"
                    >
                      <KeyRound size={14} />
                      <span>Change Password</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-brand-red text-left font-bold"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page View Container */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Horizontally Scrollable Mobile Bottom Navigation for Native App Feel */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0F1117]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-2 py-1.5 flex items-center overflow-x-auto no-scrollbar gap-1 z-30 shadow-lg select-none">
        {navLinks.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all shrink-0 min-w-[62px] ${
                isActive
                  ? 'text-brand-red font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-[9px] mt-0.5 tracking-tight truncate max-w-[65px]">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
};

export default PortalLayout;
