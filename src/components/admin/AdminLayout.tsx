import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import SearchModal from '../ui/SearchModal';
import { Tooltip } from '../ui/Tooltip';
import { JaystarblissIcon } from '../common/JaystarblissLogo';
import SEO from '../ui/SEO';
import NotificationBell from '../common/NotificationBell';
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
  ChevronLeft,
  ChevronRight
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  const { toast } = useToast();
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

  const navigationGroups: NavGroup[] = [
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
        { name: "Parents & Payments", href: "/admin/parents", icon: CreditCard, desc: "Tuition transactions & family plans" },
        { name: "Faculty & Staff", href: "/admin/staff", icon: UserCheck, desc: "Staff invitations & faculty curriculum" },
        { name: "Affiliated Schools", href: "/admin/schools", icon: School, desc: "6 Partner Montessori portals & exams" },
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

        <div className="flex-1 overflow-y-auto overscroll-contain py-4 px-3 space-y-6 custom-scrollbar">
          {navigationGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                {group.sectionTitle}
              </div>
              <nav className="space-y-0.5">
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
              </nav>
            </div>
          ))}
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

      {/* Desktop Sidebar (Collapsible & Independently Scrollable) */}
      <aside 
        className={`hidden lg:flex bg-white dark:bg-[#10141f]/95 backdrop-blur-xl text-slate-900 dark:text-white flex-col h-full max-h-screen border-r border-gray-200/80 dark:border-white/5 shrink-0 select-none transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Header with Logo and Collapse Toggle */}
        <div className={`flex items-center justify-between h-16 px-4 bg-white dark:bg-[#10141f] border-b border-gray-100 dark:border-white/5 shrink-0 ${sidebarCollapsed ? 'flex-col justify-center gap-1 px-2' : ''}`}>
          <Tooltip content="Return to Public Website" placement="right">
            <Link to="/" className="flex items-center gap-2.5 group">
              <JaystarblissIcon className="w-8 h-8 group-hover:scale-105 transition-transform shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-xs sm:text-sm tracking-tight text-gray-900 dark:text-white flex items-center gap-1 whitespace-nowrap">
                    JAYSTARBLISS STUDIOS
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-70 transition-opacity text-slate-400" />
                  </span>
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-mono font-semibold">Admin Console</span>
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
        <div className="flex-1 overflow-y-auto overscroll-contain py-4 px-2.5 space-y-5 custom-scrollbar">
          {navigationGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!sidebarCollapsed ? (
                <div className="px-3 text-[10px] font-mono font-bold tracking-widest text-gray-400 dark:text-slate-400 uppercase truncate">
                  {group.sectionTitle}
                </div>
              ) : (
                <div className="h-px bg-gray-100 dark:bg-white/10 mx-2 my-2" />
              )}
              
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== '/admin');
                  const Icon = item.icon;
                  return (
                    <Tooltip 
                      key={item.name} 
                      content={sidebarCollapsed ? `${item.name} • ${item.desc}` : item.desc} 
                      placement="right" 
                      delay={200}
                    >
                      <Link
                        to={item.href}
                        className={`group flex items-center px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                          sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                        } ${
                          isActive 
                            ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-500/25 shadow-xs' 
                            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon 
                          className={`flex-shrink-0 h-4 w-4 transition-colors ${
                            sidebarCollapsed ? '' : 'mr-2.5'
                          } ${
                            isActive ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-900 dark:group-hover:text-white'
                          }`} 
                        />
                        {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                      </Link>
                    </Tooltip>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Desktop Sidebar Footer */}
        <div className={`p-3 border-t border-gray-100 dark:border-white/5 shrink-0 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <Tooltip content="End administrative session" placement={sidebarCollapsed ? "right" : "top"}>
            <button 
              id="btn-admin-sidebar-logout"
              type="button"
              onClick={handleLogout}
              className={`flex items-center text-xs font-bold text-gray-500 dark:text-slate-400 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer ${
                sidebarCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full px-3 py-2'
              }`}
            >
              <LogOut className={`h-4 w-4 text-gray-400 dark:text-slate-500 ${sidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!sidebarCollapsed && <span>Exit Session</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main content - Independently Scrollable */}
      <div className="flex-1 h-full max-h-screen flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] dark:bg-[#0c1017]">
        {/* Topbar */}
        <div className="flex-shrink-0 flex items-center justify-between h-16 bg-white/80 dark:bg-[#0f141e]/80 backdrop-blur-md border-b border-gray-200/80 dark:border-white/5 px-4 sm:px-6 lg:px-8 z-20 transition-colors shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Tooltip content="Open navigation menu" placement="right">
              <button 
                className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" 
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu size={22} />
              </button>
            </Tooltip>

            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {currentNav?.name || 'Overview'}
            </span>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <Tooltip content="Search admin workspace" placement="bottom">
              <button 
                onClick={() => setSearchOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Search content"
              >
                <Search size={18} />
              </button>
            </Tooltip>

            {/* Persistent Real-time Notification Bell */}
            <NotificationBell role="admin" />

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-800"></div>
            
            <Tooltip content="Administrator Terminal Session" placement="bottom">
              <div className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-200 leading-tight">Admin Officer</div>
                  <div className="text-[10px] text-green-500 font-semibold">Active Session</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  JD
                </div>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Main Content Area - Isolated independent scroll */}
        <main className="flex-1 relative overflow-y-auto overscroll-contain focus:outline-none custom-scrollbar">
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
    </div>
  );
};

export default AdminLayout;

