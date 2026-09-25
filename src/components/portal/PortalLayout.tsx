import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  BookOpen, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Calendar, 
  ExternalLink, 
  Building2, 
  CreditCard, 
  User, 
  Lock, 
  Moon, 
  Sun, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  Menu, 
  X, 
  Video, 
  Contrast, 
  ChevronLeft, 
  ChevronRight, 
  Key, 
  Award,
  ClipboardList,
  Search
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
  const { theme, toggleTheme, isHighContrast, toggleHighContrast } = useTheme();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('portal_sidebar_collapsed') === 'true');
  
  const profileRef = useRef<HTMLDivElement>(null);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('portal_sidebar_collapsed', String(next));
      return next;
    });
  };

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
      base.push({ name: 'Learning', path: '/portal/student/courses', icon: <Book size={18} />, desc: 'Curriculum & Tracks' });
      base.push({ name: 'Achievements & Badges', path: '/portal/student/achievements', icon: <Award size={18} />, desc: 'Mastery, badges & certificates' });
      base.push({ name: 'Live Classrooms', path: '/portal/student/live-classrooms', icon: <Video size={18} />, desc: 'Live lessons & sessions' });
      base.push({ name: 'Resources', path: '/portal/student/resources', icon: <BookOpen size={18} />, desc: 'Lesson Notes & Learning Materials' });
      base.push({ name: 'Assessments & Quizzes', path: '/portal/student/assessments', icon: <ClipboardList size={18} />, desc: 'CBT assessments & quizzes' });
      const registrationType = sessionStorage.getItem('studentRegistrationType');
      if (registrationType === 'individual') {
        base.push({ name: 'Payments & Fees', path: '/portal/student/payments', icon: <CreditCard size={18} />, desc: 'Personal billing & statements' });
      }
    } else if (role === 'staff') {
      base.push({ name: 'Live Classes', path: '/portal/staff/classes', icon: <Video size={18} />, desc: 'Teaching Roster' });
      base.push({ name: 'Student Access', path: '/portal/staff/credentials', icon: <Key size={18} />, desc: 'Access Credentials' });
      base.push({ name: 'Resources', path: '/portal/staff/resources', icon: <BookOpen size={18} />, desc: 'Lesson Materials' }); base.push({ name: 'Subjects I Teach', path: '/portal/staff/subjects', icon: <BookOpen size={18} />, desc: 'Teaching Subjects & Approvals' });
      base.push({ name: 'Calendar', path: '/portal/staff/calendar', icon: <Calendar size={18} />, desc: 'Teaching Timetable' });
      base.push({ name: 'Billing / Fees', path: '/portal/staff/payments', icon: <CreditCard size={18} />, desc: 'Tutor Ledger & Payouts' });
    } else if (role === 'parent') {
      base.push({ name: 'Calendar', path: '/portal/parent/calendar', icon: <Calendar size={18} />, desc: 'Class Timetable' });
      base.push({ name: 'Resources', path: '/portal/parent/resources', icon: <BookOpen size={18} />, desc: 'Learning Materials' });
      base.push({ name: 'Payments & Fees', path: '/portal/parent/payments', icon: <CreditCard size={18} />, desc: 'Invoices & Statements' });
    } else if (role === 'school') {
      base.push({ name: 'Learners Roster', path: '/portal/school/roster', icon: <Building2 size={18} />, desc: 'Student Records' });
      base.push({ name: 'Student Access', path: '/portal/school/credentials', icon: <Key size={18} />, desc: 'Student Access Packs' });
      base.push({ name: 'Class Schedules', path: '/portal/school/schedules', icon: <Calendar size={18} />, desc: 'Classes & Attendance' });
      base.push({ name: 'Exam Passcodes', path: '/portal/school/passcodes', icon: <Key size={18} />, desc: 'Active Assessment Keys' });
      base.push({ name: 'CBT Assessments', path: '/portal/school/exams', icon: <Award size={18} />, desc: 'Student Exams' });
      base.push({ name: 'Resources', path: '/portal/school/resources', icon: <BookOpen size={18} />, desc: 'School Learning Materials' });
      base.push({ name: 'Fees & Payments', path: '/portal/school/payments', icon: <CreditCard size={18} />, desc: 'School Fees & Payments' });
    }
    base.push({ name: 'Settings', path: `/portal/${role}/settings`, icon: <Settings size={18} />, desc: 'Account Preferences' });
    return base;
  };

  const navLinks = getNavLinks();
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const isStudentAccessCodeOnly = !userEmail && sessionStorage.getItem('studentDocId');

  const [studentRegistrationType, setStudentRegistrationType] = useState(() => sessionStorage.getItem('studentRegistrationType') || '');
  useEffect(() => {
    if (role !== 'student') return;
    const sync = () => setStudentRegistrationType(sessionStorage.getItem('studentRegistrationType') || '');
    window.addEventListener('jaystar-student-registration-type', sync);
    sync();
    return () => window.removeEventListener('jaystar-student-registration-type', sync);
  }, [role]);
  const studentCanPay = role === 'student' && studentRegistrationType === 'individual';
  const bottomNavItems = [
    { name: 'Home', path: `/portal/${role}`, icon: <LayoutDashboard size={20} /> },
    { name: role === 'school' ? 'Roster' : role === 'student' ? 'Learning' : 'Classes', path: role === 'school' ? '/portal/school/roster' : role === 'student' ? '/portal/student/courses' : `/portal/${role}/calendar`, icon: <BookOpen size={20} /> },
    { name: role === 'student' ? 'Live' : 'Calendar', path: role === 'student' ? '/portal/student/live-classrooms' : `/portal/${role}/calendar`, icon: role === 'student' ? <Video size={20} /> : <Calendar size={20} /> },
    ...(role === 'student' && !studentCanPay ? [] : [{ name: 'Payments', path: `/portal/${role}/payments`, icon: <CreditCard size={20} /> }]),
    { name: 'Settings', path: `/portal/${role}/settings`, icon: <Settings size={20} /> }
  ];

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
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white" 
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }} 
            className="md:hidden bg-[#0F1117] text-white px-4 py-4 space-y-1.5 border-b border-white/10 z-30 max-h-[calc(100vh-60px)] overflow-y-auto custom-scrollbar shrink-0 shadow-2xl"
          >
            <div className="px-3 py-2 mb-2 bg-white/5 rounded-2xl flex items-center gap-3">
              {photoURL ? (
                <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover border border-brand-red/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs">
                  {displayName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate text-white">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{userEmail || `${role} portal`}</p>
              </div>
            </div>

            {navLinks.map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link 
                  key={link.name} 
                  to={link.path} 
                  onClick={() => setMobileMenuOpen(false)} 
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                    isActive 
                      ? 'bg-brand-red text-white shadow-xs font-bold' 
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {link.icon}
                  <span>{link.name}</span>
                </Link>
              );
            })}

            <div className="pt-3 border-t border-white/10 flex gap-2">
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
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Shell (Consistent Dark Slate as shown in design board) */}
      <aside 
        className={`hidden md:flex bg-[#0F1117] text-white flex-col h-full max-h-screen border-r border-slate-800/80 shrink-0 select-none transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 ${sidebarCollapsed ? 'flex-col gap-3 py-4' : ''}`}>
          <Tooltip content="Return to Main Website" placement="right">
            <Link to="/" className="flex items-center gap-2.5 group">
              <JaystarblissIcon className="w-8 h-8 group-hover:scale-105 transition-transform shrink-0" />
              {!sidebarCollapsed && (
                <span className="font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap text-white">
                  JAYSTARBLISS
                  <ExternalLink size={12} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                </span>
              )}
            </Link>
          </Tooltip>
          <Tooltip content={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} placement="right">
            <button 
              type="button" 
              onClick={toggleSidebarCollapse} 
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" 
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
          </Tooltip>
        </div>

        {/* Portal Role Badge */}
        {!sidebarCollapsed && (
          <div className="px-5 pt-4 pb-1 shrink-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold flex items-center justify-between">
              <span>{role} Workspace</span>
              <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" title="Active Session"></span>
            </p>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto custom-scrollbar space-y-1">
          {navLinks.map(link => {
            const isActive = location.pathname === link.path;
            return (
              <Tooltip key={link.name} content={sidebarCollapsed ? `${link.name} • ${link.desc}` : link.desc} placement="right" delay={200}>
                <Link 
                  to={link.path} 
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                  } ${
                    isActive 
                      ? 'bg-brand-red text-white shadow-xs font-bold' 
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="shrink-0">{link.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{link.name}</span>}
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className={`p-3 border-t border-slate-800/80 shrink-0 space-y-1.5 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          {!sidebarCollapsed ? (
            <button 
              type="button" 
              onClick={toggleTheme} 
              className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center justify-between text-xs font-semibold" 
              aria-label="Toggle Theme"
            >
              <span>Appearance</span>
              {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
            </button>
          ) : (
            <Tooltip content="Toggle Light/Dark Theme" placement="right">
              <button 
                type="button" 
                onClick={toggleTheme} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors" 
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
              </button>
            </Tooltip>
          )}

          <Tooltip content="Sign Out" placement={sidebarCollapsed ? 'right' : 'top'}>
            <button 
              type="button" 
              onClick={handleLogout} 
              className={`flex items-center gap-3 py-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-white/5 transition-colors text-xs font-semibold ${
                sidebarCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full px-3 text-left'
              }`} 
              aria-label="Log Out"
            >
              <LogOut size={15} className="shrink-0" />
              {!sidebarCollapsed && <span>Log Out</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 h-full max-h-screen flex flex-col min-w-0 bg-[#F8FAFC] dark:bg-[#0B0F17] overflow-y-auto custom-scrollbar pb-16 md:pb-0">
        {/* Admin Masquerade Mode Active Indicator */}
        {(() => {
          const masqueradeRaw = sessionStorage.getItem('admin_masquerade');
          let masquerade: any = null;
          if (masqueradeRaw) {
            try { masquerade = JSON.parse(masqueradeRaw); } catch {}
          }
          if (!masquerade?.isMasquerading) return null;

          return (
            <div className="bg-gradient-to-r from-amber-600 via-brand-red to-red-700 text-white px-4 sm:px-6 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs font-bold sticky top-0 z-30 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-white/20 uppercase tracking-wider text-[10px] font-black">
                  Admin Impersonation Mode
                </span>
                <span>
                  Viewing {masquerade.targetRole} dashboard as: <strong className="underline decoration-white/60">{masquerade.targetUser?.name || masquerade.targetUser?.fullName || masquerade.targetUser?.email || 'User'}</strong> {masquerade.targetUser?.email ? `(${masquerade.targetUser.email})` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('admin_masquerade');
                  sessionStorage.setItem('userRole', 'admin');
                  navigate('/admin');
                }}
                className="px-3.5 py-1.5 bg-white text-gray-900 rounded-xl font-extrabold text-xs hover:bg-amber-100 shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <span>Exit View-As &amp; Return to Admin</span>
                <ChevronRight size={14} />
              </button>
            </div>
          );
        })()}

        {!isEmailVerified && userEmail && !isStudentAccessCodeOnly && (
          <div className="bg-amber-500 text-slate-950 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold shadow-xs shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-slate-950" />
              <span>Please verify your email address (<strong>{userEmail}</strong>) to guarantee uninterrupted portal access.</span>
            </div>
            <button 
              type="button" 
              onClick={handleResendEmail} 
              disabled={resendingVerification} 
              className="underline hover:text-white cursor-pointer transition-colors self-start sm:self-auto font-black"
            >
              {resendingVerification ? 'Sending...' : 'Resend Verification Email'}
            </button>
          </div>
        )}

        {/* Top Header with Search and Profile */}
        <header className="bg-white dark:bg-[#161B26] border-b border-slate-200/80 dark:border-slate-800/80 px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-20 shrink-0 transition-colors shadow-xs">
          {/* Integrated Search Bar */}
          <div className="flex-1 max-w-xs sm:max-w-md mr-2 sm:mr-4">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 sm:pl-9 pr-6 sm:pr-8 py-1 sm:py-1.5 text-[11px] sm:text-xs rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-red transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Right Header: Notification, Theme, Profile */}
          <div className="flex items-center gap-1 sm:gap-3 relative" ref={profileRef}>
            <NotificationBell 
              role={role as any} 
              userId={auth.currentUser?.uid} 
              studentId={sessionStorage.getItem('studentDocId') || undefined} 
              schoolId={sessionStorage.getItem('schoolDocId') || undefined} 
            />

            <Tooltip content={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} placement="bottom">
              <button 
                type="button" 
                onClick={toggleTheme} 
                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" 
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={13} className="text-amber-400 sm:w-[15px] sm:h-[15px]" /> : <Moon size={13} className="text-slate-600 sm:w-[15px] sm:h-[15px]" />}
              </button>
            </Tooltip>

            {/* Profile Dropdown */}
            <button 
              type="button" 
              onClick={() => setShowProfileMenu(!showProfileMenu)} 
              className="flex items-center gap-1.5 sm:gap-2.5 py-0.5 px-1 sm:py-1 sm:px-1.5 rounded-xl sm:rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700" 
              aria-label="User Profile Menu"
            >
              {photoURL ? (
                <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border border-brand-red/40 shrink-0" />
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase shrink-0">
                  {displayName.charAt(0)}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[120px]">{displayName}</p>
                <p className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
                  <span>{role}</span>
                  {isEmailVerified && <CheckCircle2 size={10} className="text-green-500" />}
                </p>
              </div>
              <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                  transition={{ duration: 0.15 }} 
                  className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 z-50 space-y-1 text-xs"
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-slate-400 text-[11px] truncate">{userEmail || `@${role}`}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-brand-red/10 text-brand-red">{role} Access</span>
                    </div>
                  </div>

                  <Link 
                    to={`/portal/${role}/settings`} 
                    onClick={() => setShowProfileMenu(false)} 
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    <User size={14} className="text-brand-red" />
                    <span>Profile Preferences</span>
                  </Link>

                  <button 
                    type="button" 
                    onClick={() => { setShowProfileMenu(false); setShowPasswordModal(true); }} 
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-left"
                  >
                    <Lock size={14} className="text-amber-500" />
                    <span>Change Password</span>
                  </button>

                  <Link 
                    to={`/portal/${role}/payments`} 
                    onClick={() => setShowProfileMenu(false)} 
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    <CreditCard size={14} className="text-emerald-500" />
                    <span>Tuition & Statements</span>
                  </Link>

                  <div className="pt-1.5 pb-1 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      id="btn-profile-high-contrast" 
                      type="button" 
                      onClick={() => { toggleHighContrast(); toast.info(!isHighContrast ? 'High-contrast mode activated' : 'Standard contrast mode restored'); }} 
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-left" 
                    >
                      <div className="flex items-center gap-2.5">
                        <Contrast size={14} className={isHighContrast ? 'text-brand-red' : 'text-cyan-500'} />
                        <span className="text-xs">High Contrast</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isHighContrast ? 'bg-brand-red text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {isHighContrast ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      type="button" 
                      onClick={handleLogout} 
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors font-bold text-left"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Content Outlet */}
        <div className="p-4 sm:p-6 lg:p-7 flex-1">
          <AnimatePresence mode="wait">
            <motion.div 
              key={location.pathname} 
              initial={{ opacity: 0, y: 6 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -6 }} 
              transition={{ duration: 0.15 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar for Native-App Feel */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0F1117]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-2 py-2 flex items-center justify-around z-30 shadow-lg">
        {bottomNavItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                isActive
                  ? 'text-brand-red font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5 tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
};

export default PortalLayout;
