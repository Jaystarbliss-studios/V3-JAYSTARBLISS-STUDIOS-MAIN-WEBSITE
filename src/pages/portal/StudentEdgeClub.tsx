import React from 'react';
import EdClubLaunchBanner from '../../components/portal/EdClubLaunchBanner';

/**
 * Compatibility entry for an older deep link. Ed Club remains the existing
 * banner/launch feature; there is no separate club workspace here.
 */
const StudentEdgeClub: React.FC = () => (
  <div className="max-w-5xl mx-auto py-6">
    <EdClubLaunchBanner
      studentName={sessionStorage.getItem('studentName') || sessionStorage.getItem('userName') || 'Student'}
      studentClass={sessionStorage.getItem('studentClass') || ''}
      schoolId={sessionStorage.getItem('studentSchoolId') || sessionStorage.getItem('schoolId') || ''}
    />
  </div>
);

export default StudentEdgeClub;
