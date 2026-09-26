import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import SearchModal from '../ui/SearchModal';
import { Tooltip } from '../ui/Tooltip';
import { JaystarblissIcon } from '../common/JaystarblissLogo';
import SEO from '../ui/SEO';
import NotificationBell from '../common/NotificationBell';
import ImpersonateUserModal from './ImpersonateUserModal';
import adminBgWallpaper from '../../assets/jdi login bg.png';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Briefcase, 
  FolderOpen, 
  FileText, 
  MessageSquare, 
  Settings,
  LogOut,
  Menu,
  X,
  Gamepad2,
  Search,
  ExternalLink,
  UserCheck,
  School,
  CreditCard,
  Bell,
  Activity,
  Layers,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Sun,
  Moon
} from 'lucide-react';

interface NavGroup {
  sectionTitle: string;
  items: {
    name: string;
    href: string;
    icon: any;
    desc: string;
    badge?: string;
  }[];
}

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  // Collapsible Section Accordion State - Persists user choice and keeps active section open
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('admin_expanded_nav_sections');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading admin expanded nav sections:', e);
    }
    return {
      "Overview & Operations": true,
      "Website & Pages CMS": true,
      "Portals & Academic Hub": true,
      "System & Management": true,
    };
  });

  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    sessionStorage.clear();
    localStorage.removeItem('jaystar_cached_user_role');
    localStorage.removeItem('jaystar_cached_user_id');
    localStorage.removeItem('admin_sidebar_collapsed');
    toast.success('Admin session terminated');
    navigate('/portal');
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const currentRole = (sessionStorage.getItem('userRole') || 'super_admin').toUpperCase();

  const allNavigationGroups: NavGroup[] = [
    {
      sectionTitle: "Overview & Operations",
      items: [
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard, desc: "System KPIs, metrics & analytics" },
        { name: "Inquiries & Leads", href: "/admin/inquiries", icon: MessageSquare, desc: "Public inquiries & contact requests" },
        { name: "Activity Logs", href: "/admin/activity", icon: Activity, desc: "Real-time authentication & operation audit" },
      ]
    },
    {
      sectionTitle: "Website & Pages CMS",
      items: [
        { name: "Pages & Section CMS", href: "/admin/pages", icon: Layers, desc: "Live content & visual sections editor" },
        { name: "Programs & Courses", href: "/admin/programs", icon: BookOpen, desc: "Curriculum tracks, stages & syllabi" },
        { name: "Services Catalog", href: "/admin/services", icon: Briefcase, desc: "Custom software & institutional solutions" },
        { name: "Portfolio Showcase", href: "/admin/portfolio", icon: FolderOpen, desc: "Client deliverables & case studies" },
        { name: "Kids Zone Builds", href: "/admin/kids-projects", icon: Gamepad2, desc: "Scholars gaming & app showcase" },
        { name: "News Corner & Blog", href: "/admin/blog", icon: FileText, desc: "Articles, announcements & press" },
      ]
    },
    {
      sectionTitle: "Portals & Academic Hub",
      items: [
        { name: "Approvals & Requests", href: "/admin/approvals", icon: UserCheck, desc: "Student, tutor & enrollment approvals" },
        { name: "Scholars & Students", href: "/admin/students", icon: Users, desc: "Student credentials & individual dispatches" },
        { name: "Parents & Families", href: "/admin/parents", icon: Users, desc: "Manage parent accounts, children, enrollments & family records" },
        { name: "Billings / Fees", href: "/admin/billing", icon: CreditCard, desc: "Tuition transactions, treasury & ledger" },
        { name: "Faculty & Staff", href: "/admin/staff", icon: UserCheck, desc: "Staff invitations & faculty curriculum" },
        { name: "Tutor Subjects", href: "/admin/tutor-subjects", icon: BookOpen, desc: "Approve subjects & find matching tutors" },
        { name: "Affiliated Schools", href: "/admin/schools", icon: School, desc: "Partner school portals & exams" },
        { name: "Class Schedules", href: "/admin/schedules", icon: CalendarDays, desc: "Recurring school classes & attendance history" },
        { name: "Learning Resources", href: "/admin/resources", icon: FolderOpen, desc: "General downloads, links & tests" },
      ]
    },
    {
      sectionTitle: "System & Management",
      items: [
        { name: "Notifications", href: "/admin/notifications", icon: Bell, desc: "Push broadcasts & alerts" },
        { name: "Users & RBAC", href: "/admin/users", icon: Users, desc: "User accounts & role permissions" },
        { name: "Settings & Cloud", href: "/admin/settings", icon: Settings, desc: "Cloudinary & system configuration" },
      ]
    }
  ];

  const navigationGroups: NavGroup[] = useMemo(() => {
    if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || auth.currentUser?.email === 'johnrufai242@gmail.com') {
      return allNavigationGroups;
    }

    if (currentRole === 'CMS_ADMIN' || currentRole === 'CONTENT_ADMIN') {
      return [
        {
          sectionTitle: "Overview & Operations",
          items: [
            { name: "Dashboard", href: "/admin", icon: LayoutDashboard, desc: "System KPIs, metrics & analytics" },
            { name: "Inquiries & Leads", href: "/admin/inquiries", icon: MessageSquare, desc: "Public inquiries & contact requests" },
          ]
        },
        {
          sectionTitle: "Website & Pages CMS",
          items: [
            { name: "Pages & Section CMS", href: "/admin/pages", icon: Layers, desc: "Live content & visual sections editor" },
            { name: "Programs & Courses", href: "/admin/programs", icon: BookOpen, desc: "Curriculum tracks, stages & syllabi" },
            { name: "Services Catalog", href: "/admin/services", icon: Briefcase, desc: "Custom software & institutional solutions" },
            { name: "Portfolio Showcase", href: "/admin/portfolio", icon: FolderOpen, desc: "Client deliverables & case studies" },
            { name: "Kids Zone Builds", href: "/admin/kids-projects", icon: Gamepad2, desc: "Scholars gaming & app showcase" },
            { name: "News Corner & Blog", href: "/admin/blog", icon: FileText, desc: "Articles, announcements & press" },
          ]
        },
        {
          sectionTitle: "System & Management",
          items: [
            { name: "Notifications", href: "/admin/notifications", icon: Bell, desc: "Push broadcasts & alerts" },
          ]
        }
      ];
    }

    if (currentRole === 'ACADEMIC_ADMIN' || currentRole === 'EDUCATION_ADMIN') {
      return [
        {
          sectionTitle: "Overview & Operations",
          items: [
            { name: "Dashboard", href: "/admin", icon: LayoutDashboard, desc: "System KPIs, metrics & analytics" },
            { name: "Inquiries & Leads", href: "/admin/inquiries", icon: MessageSquare, desc: "Public inquiries & contact requests" },
          ]
        },
        {
          sectionTitle: "Portals & Academic Hub",
          items: [
            { name: "Approvals & Requests", href: "/admin/approvals", icon: UserCheck, desc: "Student, tutor & enrollment approvals" },
            { name: "Scholars & Students", href: "/admin/students", icon: Users, desc: "Student credentials & individual dispatches" },
            { name: "Faculty & Staff", href: "/admin/staff", icon: UserCheck, desc: "Staff invitations & faculty curriculum" },
            { name: "Tutor Subjects", href: "/admin/tutor-subjects", icon: BookOpen, desc: "Approve subjects & find matching tutors" },
            { name: "Affiliated Schools", href: "/admin/schools", icon: School, desc: "Partner school portals & exams" },
            { name: "Class Schedules", href: "/admin/schedules", icon: CalendarDays, desc: "Recurring school classes & attendance history" },
            { name: "Learning Resources", href: "/admin/resources", icon: FolderOpen, desc: "General downloads, links & tests" },
          ]
        },
        {
          sectionTitle: "Website & Pages CMS",
          items: [
            { name: "Programs & Courses", href: "/admin/programs", icon: BookOpen, desc: "Curriculum tracks, stages & syllabi" },
          ]
        },
        {
          sectionTitle: "System & Management",
          items: [
            { name: "Notifications", href: "/admin/notifications", icon: Bell, desc: "Push broadcasts & alerts" },
          ]
        }
      ];
    }

    if (currentRole === 'FINANCE_ADMIN') {
      return [
        {
          sectionTitle: "Overview & Operations",
          items: [
            { name: "Dashboard", href: "/admin", icon: LayoutDashboard, desc: "System KPIs, metrics & analytics" },
            { name: "Activity Logs", href: "/admin/activity", icon: Activity, desc: "Real-time authentication & operation audit" },
          ]
        },
        {
          sectionTitle: "Portals & Academic Hub",
          items: [
            { name: "Billings / Fees", href: "/admin/billing", icon: CreditCard, desc: "Tuition transactions, treasury & ledger" },
            { name: "Approvals & Requests", href: "/admin/approvals", icon: UserCheck, desc: "Payment approvals & fee adjustments" },
          ]
        },
        {
          sectionTitle: "System & Management",
          items: [
            { name: "Notifications", href: "/admin/notifications", icon: Bell, desc: "Push broadcasts & alerts" },
          ]
        }
      ];
    }

    return allNavigationGroups;
  }, [currentRole]);

  // Auto-expand section containing current active route on route changes if not explicitly tracked
  useEffect(() => {
    navigationGroups.forEach(group => {
      const hasActive = group.items.some(
        item => location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin')
      );
      if (hasActive) {
        setExpandedSections(prev => {
          if (prev[group.sectionTitle] === false) return prev; // User explicitly collapsed it
          if (prev[group.sectionTitle] === true) return prev;
          const next = { ...prev, [group.sectionTitle]: true };
          try {
            localStorage.setItem('admin_expanded_nav_sections', JSON.stringify(next));
          } catch (e) {
            console.warn('Could not save expanded nav sections:', e);
          }
          return next;
        });
      }
    });
  }, [location.pathname]);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => {
      const next = {
        ...prev,
        [sectionTitle]: !prev[sectionTitle]
      };
      try {
        localStorage.setItem('admin_expanded_nav_sections', JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save expanded nav sections:', e);
      }
      return next;
    });
  };

  const areAllSectionsExpanded = navigationGroups.every(g => expandedSections[g.sectionTitle] === true);

  const toggleAllSections = () => {
    setExpandedSections(() => {
      const nextState = !areAllSectionsExpanded;
      const next: Record<string, boolean> = {};
      navigationGroups.forEach(g => {
        next[g.sectionTitle] = nextState;
      });
      try {
        localStorage.setItem('admin_expanded_nav_sections', JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save expanded nav sections:', e);
      }
      return next;
    });
  };

  const closeSidebar = () => setSidebarOpen(false);
  
  const allNavItems = navigationGroups.flatMap(g => g.items);
  const currentNav = allNavItems.find(n => n.href === location.pathname);
  const currentTitle = currentNav ? `Admin ${currentNav.name}` : 'Admin Management Panel';

  return (
    <div className="digital-canvas h-screen w-full flex overflow-hidden">
      <SEO 
        title={currentTitle} 
        description="Jaystarbliss Studios Administration and Content Management System." 
        noindex={true}
      />

      {/* Mobile sidebar overlay backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-xs transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeSidebar}
      />

      {/* Mobile Drawer (Independent Scroll) */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-brand-slate text-white flex flex-col h-full overflow-hidden transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 bg-brand-slate border-b border-white/10 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group" onClick={closeSidebar}>
            <JaystarblissIcon className="w-8 h-8 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap">
                JAYSTARBLISS STUDIOS
              </span>
              <span className="text-[10px] text-slate-400 font-mono font-semibold">Admin Console</span>
            </div>
          </Link>
          <button 
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10" 
            onClick={closeSidebar}
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain py-4 px-3 space-y-4 custom-scrollbar">
          {navigationGroups.map((group, gIdx) => {
            const isExpanded = expandedSections[group.sectionTitle] !== false;
            const hasActiveItem = group.items.some(
              item => location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin')
            );

            return (
              <div key={gIdx} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(group.sectionTitle)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-mono font-bold tracking-wider text-slate-300 hover:text-white uppercase transition-colors rounded-xl hover:bg-white/5 cursor-pointer select-none group"
                  aria-expanded={isExpanded}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${hasActiveItem ? 'bg-brand-red' : 'bg-slate-600 group-hover:bg-slate-400'}`} />
                    <span className="truncate">{group.sectionTitle}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 font-mono font-medium">
                      {group.items.length}
                    </span>
                    <ChevronDown 
                      size={14} 
                      className={`text-slate-400 group-hover:text-white transition-transform duration-200 ${
                        isExpanded ? 'rotate-0' : '-rotate-90'
                      }`} 
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.nav
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="space-y-0.5 overflow-hidden pl-1.5"
                    >
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin');
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={closeSidebar}
                            className={`group flex items-center px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                              isActive 
                                ? 'bg-brand-red text-white shadow-sm' 
                                : 'text-gray-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <Icon 
                              className={`flex-shrink-0 mr-2.5 h-4 w-4 transition-colors ${
                                isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                              }`} 
                            />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                    </motion.nav>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 shrink-0">
          <button 
            id="btn-admin-mobile-logout"
            type="button"
            onClick={() => {
              closeSidebar();
              handleLogout();
            }}
            className="flex items-center w-full px-3 py-2 text-xs font-bold text-gray-300 rounded-xl hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="mr-2.5 h-4 w-4 text-gray-400" />
            <span>Exit Session</span>
          </button>
        </div>
      </div>

      {/* Desktop Sidebar (Collapsible, Frosted Glass & Independently Scrollable) */}
      <aside 
        className={`hidden lg:flex bg-white/80 dark:bg-[#0c1220]/80 backdrop-blur-2xl text-slate-900 dark:text-white flex-col h-full max-h-screen border-r border-slate-200/80 dark:border-white/10 shrink-0 select-none transition-all duration-300 ease-in-out relative z-30 shadow-lg shadow-black/5 ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Header with Logo and Collapse Toggle */}
        <div className={`flex items-center justify-between h-16 px-4 border-b border-slate-200/60 dark:border-white/10 shrink-0 ${sidebarCollapsed ? 'flex-col justify-center gap-1 px-2' : ''}`}>
          <Tooltip content="Return to Public Website" placement="right">
            <Link to="/" className="flex items-center gap-2.5 group">
              <JaystarblissIcon className="w-8 h-8 group-hover:scale-105 transition-transform shrink-0 drop-shadow-sm" />
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-xs sm:text-sm tracking-tight text-gray-900 dark:text-white flex items-center gap-1 whitespace-nowrap">
                    JAYSTARBLISS STUDIOS
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-70 transition-opacity text-slate-400" />
                  </span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-semibold">Admin Console</span>
                </div>
              )}
            </Link>
          </Tooltip>

          <Tooltip content={sidebarCollapsed ? "Expand Sidebar Menu" : "Collapse Sidebar Menu"} placement="right">
            <button 
              className="text-gray-400 dark:text-white/60 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" 
              onClick={toggleSidebarCollapse}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </Tooltip>
        </div>

        {/* Sidebar Nav Items - Independently Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3 px-2.5 space-y-3 custom-scrollbar">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                Navigation
              </span>
              <button
                type="button"
                onClick={toggleAllSections}
                className="text-[10px] font-mono text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-sky-500/10"
              >
                <ChevronsUpDown size={11} />
                <span>{areAllSectionsExpanded ? 'Collapse All' : 'Expand All'}</span>
              </button>
            </div>
          )}

          {navigationGroups.map((group, gIdx) => {
            const isExpanded = expandedSections[group.sectionTitle] !== false;
            const hasActiveItem = group.items.some(
              item => location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin')
            );

            return (
              <div key={gIdx} className="space-y-1">
                {!sidebarCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.sectionTitle)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-mono font-bold tracking-widest text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white uppercase transition-colors rounded-lg hover:bg-slate-900/5 dark:hover:bg-white/5 cursor-pointer select-none group"
                    aria-expanded={isExpanded}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${hasActiveItem ? 'bg-sky-500 shadow-xs shadow-sky-500/50' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'}`} />
                      <span className="truncate">{group.sectionTitle}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-mono font-semibold">
                        {group.items.length}
                      </span>
                      <ChevronDown 
                        size={13} 
                        className={`text-gray-400 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white transition-transform duration-200 shrink-0 ${
                          isExpanded ? 'rotate-0' : '-rotate-90'
                        }`} 
                      />
                    </div>
                  </button>
                ) : (
                  <div className="h-px bg-gray-100 dark:bg-white/10 mx-2 my-2" />
                )}
                
                {sidebarCollapsed ? (
                  <nav className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin');
                      const Icon = item.icon;
                      return (
                        <Tooltip 
                          key={item.name} 
                          content={`${item.name} • ${item.desc}`} 
                          placement="right" 
                          delay={200}
                        >
                          <Link
                            to={item.href}
                            className={`group flex items-center px-2 py-2 text-xs font-bold rounded-xl transition-all justify-center ${
                              isActive 
                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-400/30 dark:border-sky-500/30 shadow-xs backdrop-blur-md' 
                                : 'text-gray-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <Icon 
                              className={`flex-shrink-0 h-4 w-4 transition-colors ${
                                isActive ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white'
                              }`} 
                            />
                          </Link>
                        </Tooltip>
                      );
                    })}
                  </nav>
                ) : (
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.nav
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="space-y-0.5 overflow-hidden pl-1"
                      >
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin');
                          const Icon = item.icon;
                          return (
                            <Tooltip 
                              key={item.name} 
                              content={item.desc} 
                              placement="right" 
                              delay={200}
                            >
                              <Link
                                to={item.href}
                                className={`group flex items-center px-3 py-2 text-xs font-bold rounded-xl transition-all justify-start ${
                                  isActive 
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-400/30 dark:border-sky-500/30 shadow-xs backdrop-blur-md' 
                                    : 'text-gray-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                                }`}
                              >
                                <Icon 
                                  className={`flex-shrink-0 h-4 w-4 transition-colors mr-2.5 ${
                                    isActive ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white'
                                  }`} 
                                />
                                <span className="truncate">{item.name}</span>
                              </Link>
                            </Tooltip>
                          );
                        })}
                      </motion.nav>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Sidebar Footer */}
        <div className={`p-3 border-t border-slate-200/60 dark:border-white/10 shrink-0 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <Tooltip content="End administrative session" placement={sidebarCollapsed ? "right" : "top"}>
            <button 
              id="btn-admin-sidebar-logout"
              type="button"
              onClick={handleLogout}
              className={`flex items-center text-xs font-bold text-gray-500 dark:text-slate-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer ${
                sidebarCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full px-3 py-2'
              }`}
            >
              <LogOut className={`h-4 w-4 text-gray-400 dark:text-slate-500 ${sidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!sidebarCollapsed && <span>Exit Session</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main content Area with Blurred Background Image */}
      <div className="flex-1 h-full max-h-screen flex flex-col min-w-0 overflow-hidden relative">
        {/* Ambient Blurred Background Wallpaper */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
          <img 
            src={adminBgWallpaper} 
            alt="" 
            className="w-full h-full object-cover filter blur-[28px] scale-110 opacity-30 dark:opacity-40 transition-opacity" 
          />
          <div className="absolute inset-0 bg-slate-100/75 dark:bg-[#070b14]/80 backdrop-blur-sm" />
        </div>

        {/* Topbar */}
        <div className="relative z-20 flex-shrink-0 flex items-center justify-between h-13 sm:h-16 bg-white/70 dark:bg-[#0c1220]/70 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 px-2.5 sm:px-6 lg:px-8 transition-colors shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Mobile Menu Button */}
            <Tooltip content="Open navigation menu" placement="right">
              <button 
                className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shrink-0" 
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu size={18} className="sm:w-[22px] sm:h-[22px]" />
              </button>
            </Tooltip>

            <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">
              {currentNav?.name || 'Overview'}
            </span>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2.5">
            {/* Quick User Impersonator Button */}
            <Tooltip content="Direct Dashboard Login & User Search" placement="bottom">
              <button
                type="button"
                onClick={() => setImpersonateModalOpen(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold text-[11px] sm:text-xs transition-colors shrink-0"
                aria-label="Direct Dashboard Login"
              >
                <UserCheck size={13} className="sm:w-[15px] sm:h-[15px]" />
                <span className="hidden xs:inline">Log in as User</span>
              </button>
            </Tooltip>

            <Tooltip content="Search admin workspace" placement="bottom">
              <button 
                onClick={() => setSearchOpen(true)}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white rounded-lg sm:rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Search content"
              >
                <Search size={15} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </Tooltip>

            {/* Admin Theme Toggle */}
            <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} placement="bottom">
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white rounded-lg sm:rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={15} className="text-amber-400 sm:w-[18px] sm:h-[18px]" /> : <Moon size={15} className="sm:w-[18px] sm:h-[18px]" />}
              </button>
            </Tooltip>

            {/* Persistent Real-time Notification Bell */}
            <NotificationBell role="admin" />

            <div className="h-4 sm:h-6 w-px bg-slate-200/80 dark:bg-slate-800"></div>
            
            <Tooltip content="Administrator Profile" placement="bottom">
              <div className="flex items-center gap-1.5 sm:gap-2.5 py-1 px-1.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">Admin Officer</div>
                </div>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-sky-600 to-blue-600 text-white flex items-center justify-center font-black text-[10px] sm:text-xs shadow-xs">
                  JD
                </div>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Main Content Area - Isolated independent scroll */}
        <main className="flex-1 relative z-10 overflow-y-auto overscroll-contain focus:outline-none custom-scrollbar">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ImpersonateUserModal isOpen={impersonateModalOpen} onClose={() => setImpersonateModalOpen(false)} />
    </div>
  );
};

export default AdminLayout;

