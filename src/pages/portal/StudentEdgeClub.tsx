import React from 'react';
import { Navigate } from 'react-router-dom';
import EdClubLaunchBanner from '../../components/portal/EdClubLaunchBanner';

/**
 * Compatibility entry kept for older deep links. Ed Club is a banner/launch
 * feature, not a separate student workspace or portal route.
 */
const StudentEdgeClub: React.FC = () => {
  const enabled = sessionStorage.getItem('studentEdClubEnabled') === 'true';
  if (!enabled) return <Navigate to="/portal/student" replace />;
  return (
    <div className="max-w-5xl mx-auto py-6">
      <EdClubLaunchBanner
        studentName={sessionStorage.getItem('studentName') || sessionStorage.getItem('userName') || 'Student'}
        studentClass={sessionStorage.getItem('studentClass') || ''}
        schoolId={sessionStorage.getItem('studentSchoolId') || sessionStorage.getItem('schoolId') || ''}
        enabled
      />
    </div>
  );
};

export default StudentEdgeClub;
