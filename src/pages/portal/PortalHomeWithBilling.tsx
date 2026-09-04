import React from 'react';
import BillingCenter, { BillingCenterRole } from './BillingCenter';
import ParentDashboard from './ParentDashboard';
import StaffDashboard from './StaffDashboard';
import StudentDashboard from './StudentDashboard';
import SchoolDashboard from './SchoolDashboard';

const PortalHomeWithBilling: React.FC<{ role: BillingCenterRole }> = ({ role }) => {
  const dashboard = role === 'parent'
    ? <ParentDashboard />
    : role === 'staff'
      ? <StaffDashboard />
      : role === 'school'
        ? <SchoolDashboard initialTab="overview" />
        : <StudentDashboard />;
  return <div className="space-y-8">{dashboard}<BillingCenter role={role} /></div>;
};

export default PortalHomeWithBilling;
