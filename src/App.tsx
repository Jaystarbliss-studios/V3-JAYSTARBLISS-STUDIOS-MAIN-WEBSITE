import { Suspense, lazy } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SessionTimeoutProvider } from "./contexts/SessionTimeoutContext";
import { MetaTagsProvider } from "./contexts/MetaTagsContext";
import { SearchProvider } from "./contexts/SearchContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import PageLoader from "./components/ui/PageLoader";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import PageTransition from "./components/ui/PageTransition";

import Home from "./pages/Home";
import About from "./pages/About";
import Programs from "./pages/Programs";
import ProgramDetails from "./pages/ProgramDetails";
import Services from "./pages/Services";
import ServiceDetails from "./pages/ServiceDetails";
import Portfolio from "./pages/Portfolio";
import Contact from "./pages/Contact";
import ProjectRequest from "./pages/ProjectRequest";
import SchoolPartnership from "./pages/SchoolPartnership";
import TutorApplication from "./pages/TutorApplication";
import FAQ from "./pages/FAQ";
import FindTutor from "./pages/FindTutor";
import Portal from "./pages/Portal";
import Register from "./pages/Register";
import Resources from "./pages/Resources";
import Blog from "./pages/Blog";
import BlogPostDetails from "./pages/BlogPostDetails";

import ScrollToTop from "./components/ScrollToTop";
import GlassRippleListener from "./components/ui/GlassRippleListener";
import MarqueeBanner from "./components/ui/MarqueeBanner";

const MagicParticles = lazy(() => import("./pages/MagicParticles"));
const PortalLayout = lazy(() => import("./components/portal/PortalLayout"));
const ParentDashboard = lazy(() => import("./pages/portal/ParentDashboard"));
const StaffDashboard = lazy(() => import("./pages/portal/StaffDashboard"));
const StudentDashboard = lazy(() => import("./pages/portal/StudentDashboard"));
const SchoolDashboard = lazy(() => import("./pages/portal/SchoolDashboard"));
const ResourceLibrary = lazy(() => import("./pages/portal/ResourceLibrary"));
const PortalCourses = lazy(() => import("./pages/portal/PortalCourses"));
const PortalLiveClasses = lazy(() => import("./pages/portal/PortalLiveClasses"));
const PortalCalendar = lazy(() => import("./pages/portal/PortalCalendar"));
const PortalPayments = lazy(() => import("./pages/portal/PortalPayments"));
const PortalSettings = lazy(() => import("./pages/portal/PortalSettings"));

const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const ProtectedRoute = lazy(() => import("./components/admin/ProtectedRoute"));
const AdminPages = lazy(() => import("./pages/admin/AdminPages"));
const AdminPageForm = lazy(() => import("./pages/admin/AdminPageForm"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminPrograms = lazy(() => import("./pages/admin/AdminPrograms"));
const AdminProgramForm = lazy(() => import("./pages/admin/AdminProgramForm"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices"));
const AdminServiceForm = lazy(() => import("./pages/admin/AdminServiceForm"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminBlogForm = lazy(() => import("./pages/admin/AdminBlogForm"));
const AdminPortfolio = lazy(() => import("./pages/admin/AdminPortfolio"));
const AdminPortfolioForm = lazy(() => import("./pages/admin/AdminPortfolioForm"));
const AdminKidsProjects = lazy(() => import("./pages/admin/AdminKidsProjects"));
const AdminInquiries = lazy(() => import("./pages/admin/AdminInquiries"));
const AdminApprovals = lazy(() => import("./pages/admin/AdminApprovals"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents"));
const AdminParents = lazy(() => import("./pages/admin/AdminParents"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminSchools = lazy(() => import("./pages/admin/AdminSchools"));
const AdminResources = lazy(() => import("./pages/admin/AdminResources"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminActivityLogs = lazy(() => import("./pages/admin/AdminActivityLogs"));

const LazyFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center p-8">
    <div className="w-8 h-8 rounded-full border-2 border-brand-red border-t-transparent animate-spin" />
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/about" element={<PageTransition><About /></PageTransition>} />
        <Route path="/programs" element={<PageTransition><Programs /></PageTransition>} />
        <Route path="/programs/:slug" element={<PageTransition><ProgramDetails /></PageTransition>} />
        <Route path="/services" element={<PageTransition><Services /></PageTransition>} />
        <Route path="/services/:slug" element={<PageTransition><ServiceDetails /></PageTransition>} />
        <Route path="/portfolio" element={<PageTransition><Portfolio /></PageTransition>} />
        <Route path="/magic-particles" element={<Suspense fallback={<LazyFallback />}><MagicParticles /></Suspense>} />
        <Route path="/kids-zone/magic" element={<Suspense fallback={<LazyFallback />}><MagicParticles /></Suspense>} />
        <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
        <Route path="/resources" element={<PageTransition><Resources /></PageTransition>} />
        <Route path="/blog" element={<PageTransition><Blog /></PageTransition>} />
        <Route path="/blog/:slug" element={<PageTransition><BlogPostDetails /></PageTransition>} />
        <Route path="/project-request" element={<PageTransition><ProjectRequest /></PageTransition>} />
        <Route path="/school-partnership" element={<PageTransition><SchoolPartnership /></PageTransition>} />
        <Route path="/tutors" element={<PageTransition><FindTutor /></PageTransition>} />
        <Route path="/find-tutor" element={<PageTransition><FindTutor /></PageTransition>} />
        <Route path="/tutor-application" element={<PageTransition><TutorApplication /></PageTransition>} />
        <Route path="/faq" element={<PageTransition><FAQ /></PageTransition>} />

        <Route path="/portal" element={<PageTransition><Portal /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />

        <Route path="/portal/student" element={<Suspense fallback={<LazyFallback />}><ProtectedRoute allowedRoles={['STUDENT']} redirectPath="/portal"><PortalLayout /></ProtectedRoute></Suspense>}>
          <Route index element={<Suspense fallback={<LazyFallback />}><StudentDashboard /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={<LazyFallback />}><ResourceLibrary role="student" /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<LazyFallback />}><PortalCalendar /></Suspense>} />
          <Route path="courses" element={<Suspense fallback={<LazyFallback />}><PortalCourses /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<LazyFallback />}><PortalPayments /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<LazyFallback />}><PortalSettings /></Suspense>} />
        </Route>

        <Route path="/portal/staff" element={<Suspense fallback={<LazyFallback />}><ProtectedRoute allowedRoles={['TUTOR', 'STAFF']} redirectPath="/portal"><PortalLayout /></ProtectedRoute></Suspense>}>
          <Route index element={<Suspense fallback={<LazyFallback />}><StaffDashboard /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={<LazyFallback />}><ResourceLibrary role="staff" /></Suspense>} />
          <Route path="classes" element={<Suspense fallback={<LazyFallback />}><PortalLiveClasses /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<LazyFallback />}><PortalCalendar /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<LazyFallback />}><PortalSettings /></Suspense>} />
        </Route>

        <Route path="/portal/parent" element={<Suspense fallback={<LazyFallback />}><ProtectedRoute allowedRoles={['PARENT']} redirectPath="/portal"><PortalLayout /></ProtectedRoute></Suspense>}>
          <Route index element={<Suspense fallback={<LazyFallback />}><ParentDashboard /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={<LazyFallback />}><ResourceLibrary role="parent" /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<LazyFallback />}><PortalCalendar /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<LazyFallback />}><PortalPayments /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<LazyFallback />}><PortalSettings /></Suspense>} />
        </Route>

        <Route path="/portal/school" element={<Suspense fallback={<LazyFallback />}><ProtectedRoute allowedRoles={['SCHOOL']} redirectPath="/portal"><PortalLayout /></ProtectedRoute></Suspense>}>
          <Route index element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="overview" /></Suspense>} />
          <Route path="roster" element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="roster" /></Suspense>} />
          <Route path="passcodes" element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="passcodes" /></Suspense>} />
          <Route path="exams" element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="exams" /></Suspense>} />
          <Route path="links" element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="links" /></Suspense>} />
          <Route path="schedules" element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="schedules" /></Suspense>} />
          <Route path="partnership" element={<Suspense fallback={<LazyFallback />}><SchoolDashboard initialTab="partnership" /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={<LazyFallback />}><ResourceLibrary role="school" /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<LazyFallback />}><PortalCalendar /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<LazyFallback />}><PortalPayments /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<LazyFallback />}><PortalSettings /></Suspense>} />
        </Route>

        <Route path="/admin/login" element={<Navigate to="/portal" replace />} />

        <Route path="/admin" element={<Suspense fallback={<LazyFallback />}><ProtectedRoute><AdminLayout /></ProtectedRoute></Suspense>}>
          <Route index element={<Suspense fallback={<LazyFallback />}><AdminDashboard /></Suspense>} />
          <Route path="programs" element={<Suspense fallback={<LazyFallback />}><AdminPrograms /></Suspense>} />
          <Route path="programs/new" element={<Suspense fallback={<LazyFallback />}><AdminProgramForm /></Suspense>} />
          <Route path="programs/:id" element={<Suspense fallback={<LazyFallback />}><AdminProgramForm /></Suspense>} />
          <Route path="services" element={<Suspense fallback={<LazyFallback />}><AdminServices /></Suspense>} />
          <Route path="services/new" element={<Suspense fallback={<LazyFallback />}><AdminServiceForm /></Suspense>} />
          <Route path="services/:id" element={<Suspense fallback={<LazyFallback />}><AdminServiceForm /></Suspense>} />
          <Route path="blog" element={<Suspense fallback={<LazyFallback />}><AdminBlog /></Suspense>} />
          <Route path="blog/new" element={<Suspense fallback={<LazyFallback />}><AdminBlogForm /></Suspense>} />
          <Route path="blog/:id" element={<Suspense fallback={<LazyFallback />}><AdminBlogForm /></Suspense>} />
          <Route path="portfolio" element={<Suspense fallback={<LazyFallback />}><AdminPortfolio /></Suspense>} />
          <Route path="portfolio/new" element={<Suspense fallback={<LazyFallback />}><AdminPortfolioForm /></Suspense>} />
          <Route path="portfolio/:id" element={<Suspense fallback={<LazyFallback />}><AdminPortfolioForm /></Suspense>} />
          <Route path="kids-projects" element={<Suspense fallback={<LazyFallback />}><AdminKidsProjects /></Suspense>} />
          <Route path="inquiries" element={<Suspense fallback={<LazyFallback />}><AdminInquiries /></Suspense>} />
          <Route path="approvals" element={<Suspense fallback={<LazyFallback />}><AdminApprovals /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<LazyFallback />}><AdminUsers /></Suspense>} />
          <Route path="pages" element={<Suspense fallback={<LazyFallback />}><AdminPages /></Suspense>} />
          <Route path="pages/new" element={<Suspense fallback={<LazyFallback />}><AdminPageForm /></Suspense>} />
          <Route path="pages/:id" element={<Suspense fallback={<LazyFallback />}><AdminPageForm /></Suspense>} />
          <Route path="students" element={<Suspense fallback={<LazyFallback />}><AdminStudents /></Suspense>} />
          <Route path="parents" element={<Suspense fallback={<LazyFallback />}><AdminParents /></Suspense>} />
          <Route path="staff" element={<Suspense fallback={<LazyFallback />}><AdminStaff /></Suspense>} />
          <Route path="schools" element={<Suspense fallback={<LazyFallback />}><AdminSchools /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={<LazyFallback />}><AdminResources /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={<LazyFallback />}><AdminNotifications /></Suspense>} />
          <Route path="activity" element={<Suspense fallback={<LazyFallback />}><AdminActivityLogs /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<LazyFallback />}><AdminSettings /></Suspense>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <SessionTimeoutProvider>
            <Router>
              <MetaTagsProvider>
                <SearchProvider>
                  <PageLoader />
                  <ScrollToTop />
                  <GlassRippleListener />
                  <AnimatedRoutes />
                  <MarqueeBanner />
                </SearchProvider>
              </MetaTagsProvider>
            </Router>
          </SessionTimeoutProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
