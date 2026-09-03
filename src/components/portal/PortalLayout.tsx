import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, BookOpen, Settings, LogOut, LayoutDashboard, 
  Calendar, ExternalLink, Building2, CreditCard,
  User, Lock, Moon, Sun, ChevronDown, CheckCircle2,
  AlertCircle, Menu, X, Video, Contrast,
  ChevronLeft, ChevronRight, Key, Award
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
  const role = pathParts[2] || 'student'; // student | staff | parent | school

  const [displayName, setDisplayName] = useState('Cadet');
  const [userEmail, setUserEmail] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('portal_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('portal_sidebar_collapsed', String(next));
      return next;
    });
  };

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email || '');
      setIsEmailVerified(user.emailVerified);
      setPhotoURL(user.photoURL);
      const storedName = sessionStorage.getItem('userName') || user.displayName || user.email?.split('@')[0] || 'Cadet';
      setDisplayName(storedName);
    } else {
      const storedName = sessionStorage.getItem('userName') || 'Portal User';
      setDisplayName(storedName);
    }
  }, [location.pathname]);

  // Click outside to close dropdown
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
      if (err.code === 'auth/too-many-requests') {
        toast.error('Too many requests. Please wait a moment.');
      } else {
        toast.error('Failed to send email verification.');
      }
    } finally {
      setResendingVerification(false);
    }
  };

  const getNavLinks = () => {
    const base = [
      { name: 'Dashboard', path: `/portal/${role}`, icon: <LayoutDashboard size={18} />, desc: 'Portal Overview & Metrics' },
      { name: 'Resource Library', path: `/portal/${role}/resources`, icon: <BookOpen size={18} />, desc: 'PDFs, Lesson Notes & Syllabi' },
      { name: 'Calendar', path: `/portal/${role}/calendar`, icon: <Calendar size={18} />, desc: 'Schedules, Timetables & Labs' },
    ];

    if (role === 'student') {
      base.push({ name: 'Curriculum & Tracks', path: '/portal/student/courses', icon: <Book size={18} />, desc: '5-Stage Engineering Path' });
      base.push({ name: 'Tuition & Billing', path: '/portal/student/payments', icon: <CreditCard size={18} />, desc: 'Renew Term & Statements' });
    } else if (role === 'staff') {
      base.push({ name: 'Live Classes', path: '/portal/staff/classes', icon: <Video size={18} />, desc: 'Teaching Roster & Materials' });
    } else if (role === 'parent') {
      base.push({ name: 'Tuition & Billing', path: '/portal/parent/payments', icon: <CreditCard size={18} />, desc: 'Invoices & Fee Statements' });
    } else if (role === 'school') {
      base.push({ name: 'Students Roster', path: '/portal/school/roster', icon: <Building2 size={18} />, desc: 'Cadet Records & Access Codes' });
      base.push({ name: 'Exam Passcodes', path: '/portal/school/passcodes', icon: <Key size={18} />, desc: 'Active Assessment Keys' });
      base.push({ name: 'CBT Assessments', path: '/portal/school/exams', icon: <Award size={18} />, desc: 'Student Exams & Tests' });
      base.push({ name: 'Lab Partnership', path: '/portal/school/payments', icon: <CreditCard size={18} />, desc: 'Institutional Licensing & Fees' });
    }

    base.push({ name: 'Settings', path: `/portal/${role}/settings`, icon: <Settings size={18} />, desc: 'Account Preferences & Security' });
    return base;
  };

  const navLinks = getNavLinks();
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

  // Check if school student with access code (excluded from email banner)
  const isStudentAccessCodeOnly = !userEmail && sessionStorage.getItem('studentDocId');

  return (
    <div className="digital-canvas h-screen w-full text-slate-900 dark:text-slate-100 flex flex-col md:flex-row overflow-hidden transition-colors duration-200">
      <SEO 
        title={`${roleTitle} Portal | Jaystarbliss Studios`} 
        description={`Jaystarbliss Studios ${roleTitle} portal access and learning dashboard.`} 
        noindex={true}
      />

      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden bg-brand-slate text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <JaystarblissIcon className="w-7 h-7 shrink-0" />
          <span className="font-bold text-xs sm:text-sm tracking-tight whitespace-nowrap">JAYSTARBLISS STUDIOS</span>
          <span className="text-[10px] uppercase font-bold bg-brand-red px-2 py-0.5 rounded ml-1">{role}</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-brand-slate text-white px-4 py-4 space-y-2 border-b border-white/10 z-30 max-h-[calc(100vh-60px)] overflow-y-auto overscroll-contain custom-scrollbar shrink-0 shadow-2xl"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold ${
                  location.pathname === link.path ? 'bg-brand-red text-white shadow-sm' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}

            <div className="pt-3 border-t border-white/10 flex gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 text-xs font-bold"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/80 text-white text-xs font-bold"
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (Collapsible & Independently Scrollable) */}
      <aside 
        className={`hidden md:flex bg-white dark:bg-[#10141f]/95 backdrop-blur-xl text-slate-900 dark:text-white flex-col h-full max-h-screen border-r border-gray-200/80 dark:border-white/5 shrink-0 select-none transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className={`p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0 ${sidebarCollapsed ? 'flex-col gap-3 py-4' : ''}`}>
          <Tooltip content="Return to Main Website" placement="right">
            <Link to="/" className="flex items-center gap-2.5 group">
              <JaystarblissIcon className="w-8 h-8 group-hover:scale-105 transition-transform shrink-0" />
              {!sidebarCollapsed && (
                <span className="font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 whitespace-nowrap text-gray-900 dark:text-white">
                  JAYSTARBLISS STUDIOS
                  <ExternalLink size={13} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                </span>
              )}
            </Link>
          </Tooltip>

          <Tooltip content={sidebarCollapsed ? "Expand Sidebar Menu" : "Collapse Sidebar Menu"} placement="right">
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="p-1.5 rounded-lg text-gray-400 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </Tooltip>
        </div>

        {/* Portal Role Badge */}
        {!sidebarCollapsed && (
          <div className="px-5 pt-4 pb-2 shrink-0">
            <p className="text-[11px] text-gray-400 dark:text-white/50 uppercase tracking-widest font-bold flex items-center justify-between">
              <span>{role} Portal</span>
              <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400 animate-pulse" title="Active Session"></span>
            </p>
          </div>
        )}

        {/* Navigation Links - Scrollable independently */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto overscroll-contain custom-scrollbar space-y-1.5">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Tooltip 
                key={link.name} 
                content={sidebarCollapsed ? `${link.name} • ${link.desc}` : link.desc} 
                placement="right" 
                delay={200}
              >
                <Link
                  to={link.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                  } ${
                    isActive 
                      ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/25 font-bold shadow-xs' 
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-red-600 dark:text-red-400' : ''}`}>{link.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{link.name}</span>}
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-gray-100 dark:border-white/5 shrink-0 space-y-2 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 text-xs text-gray-500 dark:text-white/60">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                <span className="text-[11px] font-medium">Session Active</span>
              </span>
              <Tooltip content="Toggle Theme" placement="top">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-white/80 hover:text-gray-900 dark:hover:text-white"
                  aria-label="Toggle Theme"
                >
                  {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
                </button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip content="Toggle Light/Dark Theme" placement="right">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-white/80 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
              </button>
            </Tooltip>
          )}

          <Tooltip content="Sign Out of Session" placement={sidebarCollapsed ? "right" : "top"}>
            <button 
              type="button"
              onClick={handleLogout}
              className={`flex items-center gap-3 py-2.5 text-gray-500 dark:text-white/60 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-xs font-semibold ${
                sidebarCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full px-3 text-left'
              }`}
              aria-label="Log Out"
            >
              <LogOut size={16} className="shrink-0" />
              {!sidebarCollapsed && <span>Log Out</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main Content Area - Independently Scrollable */}
      <main className="flex-1 h-full max-h-screen flex flex-col min-w-0 bg-[#f8fafc] dark:bg-[#0c1017] overflow-y-auto overscroll-contain custom-scrollbar">
        
        {/* Unverified Email Warning Banner */}
        {!isEmailVerified && userEmail && !isStudentAccessCodeOnly && (
          <div className="bg-amber-500 text-slate-950 px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-bold shadow-xs shrink-0">
            <div className="flex items-start gap-2 min-w-0 pr-2">
              <AlertCircle size={16} className="shrink-0 text-slate-950" />
              <span className="min-w-0 break-words leading-5">
                Please verify your email address (<strong className="break-all">{userEmail}</strong>) to guarantee uninterrupted portal access.
              </span>
            </div>
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendingVerification}
              className="underline hover:text-white cursor-pointer transition-colors self-start md:self-auto font-black whitespace-nowrap shrink-0"
            >
              {resendingVerification ? 'Sending...' : 'Resend Verification Email'}
            </button>
          </div>
        )}

        {/* Header with Profile Dropdown */}
        <header className="bg-white/80 dark:bg-[#0f141e]/80 backdrop-blur-md border-b border-gray-200/80 dark:border-white/5 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shrink-0 transition-colors shadow-xs">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white capitalize">
              {navLinks.find(l => l.path === location.pathname)?.name || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4 relative" ref={profileRef}>
            {/* Real-time Notification Bell */}
            <NotificationBell 
              role={role as any} 
              userId={auth.currentUser?.uid}
              studentId={sessionStorage.getItem('studentDocId') || undefined}
              schoolId={sessionStorage.getItem('schoolDocId') || undefined}
            />

            {/* Quick Theme Toggle */}
            <Tooltip content={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"} placement="bottom">
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
              </button>
            </Tooltip>

            {/* Profile Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 sm:gap-3 py-1.5 px-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
              aria-label="User Profile Menu"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{displayName}</p>
                <p className="text-[11px] text-gray-500 capitalize flex items-center justify-end gap-1">
                  <span>{role}</span>
                  {isEmailVerified && <CheckCircle2 size={11} className="text-green-500" />}
                </p>
              </div>

              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-brand-red/30 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs shadow-xs uppercase shrink-0">
                  {displayName.charAt(0)}
                </div>
              )}

              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl p-3 z-50 space-y-1 text-xs"
                >
                  <div className="px-3 py-2.5 border-b border-gray-100 dark:border-slate-800 mb-1">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-gray-400 text-[11px] truncate">{userEmail || `@${role}`}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-brand-red/10 text-brand-red">
                        {role} Access
                      </span>
                      {(sessionStorage.getItem('schoolCode') || sessionStorage.getItem('studentAccessCode') || auth.currentUser?.uid) && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-gray-200/60 dark:border-slate-700">
                          Code: {sessionStorage.getItem('schoolCode') || sessionStorage.getItem('studentAccessCode') || `${auth.currentUser?.uid.slice(0, 8)}...`}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    to={`/portal/${role}/settings`}
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    <User size={15} className="text-brand-red" />
                    <span>Profile Preferences</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-semibold text-left"
                  >
                    <Lock size={15} className="text-amber-500" />
                    <span>Change Password</span>
                  </button>

                  <Link
                    to={`/portal/${role}/payments`}
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    <CreditCard size={15} className="text-green-500" />
                    <span>Tuition & Statements</span>
                  </Link>

                  {/* Accessibility & High Contrast Setting */}
                  <div className="pt-1.5 pb-1 border-t border-gray-100 dark:border-slate-800">
                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center justify-between">
                      <span>Accessibility</span>
                      <span className="text-[9px] text-brand-red font-bold">WCAG AAA</span>
                    </div>
                    <button
                      id="btn-profile-high-contrast"
                      type="button"
                      onClick={() => {
                        toggleHighContrast();
                        toast.info(!isHighContrast ? 'High-contrast mode activated' : 'Standard contrast mode restored');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-semibold text-left group"
                      title="Toggle high-contrast display for enhanced text readability"
                    >
                      <div className="flex items-center gap-2.5">
                        <Contrast size={15} className={isHighContrast ? 'text-brand-red' : 'text-cyan-500'} />
                        <span className="text-xs">High Contrast Mode</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase transition-all ${
                        isHighContrast 
                          ? 'bg-brand-red text-white shadow-xs' 
                          : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 group-hover:bg-gray-300'
                      }`}>
                        {isHighContrast ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-gray-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors font-bold text-left"
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Outlet Content with Smooth Page Transitions & Isolated Scroll */}
        <div className="p-4 sm:p-6 md:p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default PortalLayout;
