import React from 'react';
import { ArrowRight, ClipboardList, Flag, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import ParentDashboard from './ParentDashboard';
import StaffDashboard from './StaffDashboard';
import StudentDashboard from './StudentDashboard';
import SchoolDashboard from './SchoolDashboard';

const PortalHomeWithBilling: React.FC<{ role: 'student' | 'parent' | 'staff' | 'school' }> = ({ role }) => {
  const dashboard = role === 'parent'
    ? <ParentDashboard />
    : role === 'staff'
      ? <StaffDashboard />
      : role === 'school'
        ? <SchoolDashboard initialTab="overview" />
        : <StudentDashboard />;

  // Overview is intentionally a lightweight command surface. Assignments, milestones,
  // billing, resources and schedules each have dedicated navigation destinations.
  return <div className="space-y-8">{dashboard}</div>;
};

export default PortalHomeWithBilling;
