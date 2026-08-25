import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { 
  collection, getDocs, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, FileText, Video, 
  Clock, CheckCircle2, UserCheck 
} from 'lucide-react';
import SEO from '../../components/ui/SEO';
import { DashboardGreeting } from '../../components/portal/DashboardGreeting';

const StaffDashboard: React.FC = () => {
  const [resources, setResources] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Link assign modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPlatform, setLinkPlatform] = useState('Google Meet');
  const [meetingTime, setMeetingTime] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchStaffData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Staff Resources
        try {
          const resSnap = await getDocs(collection(db, 'staffGeneralResources'));
          setResources(resSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.warn('staffGeneralResources error:', e);
        }

        // 2. Fetch Students from individualStudents & students
        const sList: any[] = [];
        try {
          const isSnap = await getDocs(collection(db, 'individualStudents'));
          isSnap.forEach(d => sList.push({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('individualStudents query error:', e);
        }

        try {
          const stSnap = await getDocs(collection(db, 'students'));
          stSnap.forEach(d => {
            if (!sList.find(s => s.id === d.id)) {
              sList.push({ id: d.id, ...d.data() });
            }
          });
        } catch (e) {
          console.warn('students query error:', e);
        }
        setStudents(sList);

        // 3. Fetch Enrollment Requests
        try {
          const erSnap = await getDocs(collection(db, 'enrollment_requests'));
          setEnrollments(erSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.warn('enrollment_requests error:', e);
        }

      } catch (err) {
        console.error('Error loading staff dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
  }, []);

  const handlePostLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId || !linkUrl) return;
    setSubmittingLink(true);
    try {
      await addDoc(collection(db, 'personalLinks'), {
        studentId: targetStudentId,
        title: linkTitle || 'Class Session Link',
        url: linkUrl,
        platform: linkPlatform,
        meetingTime: meetingTime,
        tutorEmail: auth.currentUser?.email || 'mentor@jdh.institute',
        createdAt: serverTimestamp()
      });

      setSuccessMsg('Class room link posted to student portal successfully!');
      setShowLinkModal(false);
      setLinkTitle('');
      setLinkUrl('');
      setMeetingTime('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error posting link:', err);
    } finally {
      setSubmittingLink(false);
    }
  };

  return (
    <div className="dashboard-interface space-y-8">
      <SEO 
        title="Staff & Tutor Workspace Dashboard" 
        description="Access staff curriculum documents, lesson schedules, student management, and mentor resources." 
        noindex={true}
      />

      {/* Dynamic Timezone Greeting Banner */}
      <DashboardGreeting 
        name="Faculty & Instructor Console"
        role="STEM Mentor"
        subtitle="Deliver interactive lessons, broadcast meeting links to students, and review institute curriculum."
      />

      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 text-green-800 dark:text-green-300 text-sm flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="pro-surface p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Active Cadets</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{students.length}</p>
          </div>
        </div>

        <div className="pro-surface p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-red/10 text-brand-red rounded-xl flex items-center justify-center">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Enrollment Applications</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{enrollments.length}</p>
          </div>
        </div>

        <div className="pro-surface p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Staff Guides</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{resources.length}</p>
          </div>
        </div>
      </div>

      {/* Cadets List */}
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Institute Cadets</h2>
          <span className="text-xs text-gray-500 dark:text-slate-400">{students.length} Enrolled</span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-6">Loading student roster...</div>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 py-6">No students found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {students.map(st => (
              <div key={st.id} className="p-4 rounded-2xl border border-gray-200/80 dark:border-white/5 bg-gray-50/50 dark:bg-slate-900/60 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{st.fullName || st.studentName || 'Student'}</h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-red/10 text-brand-red">
                      {st.accessCode || 'CODE'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">@{st.username || 'cadet'} • {st.email || 'No email'}</p>
                  
                  <div className="mt-3 text-xs">
                    <span className="text-gray-500 dark:text-slate-400 block mb-1">Track / Plan:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{st.plan || 'Dynamic Coding Plan'}</span>
                  </div>

                  {st.schedule && (
                    <div className="mt-2 text-xs text-brand-red flex items-center gap-1">
                      <Clock size={12} /> {st.schedule}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetStudentId(st.id);
                      setShowLinkModal(true);
                    }}
                    className="text-xs font-bold text-brand-red hover:underline flex items-center gap-1"
                  >
                    <Video size={13} /> Send Live Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Staff General Resources */}
      <div className="pro-surface rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Staff Curriculum & Teaching Documents</h2>
        {resources.length === 0 ? (
          <div className="text-sm text-gray-500 py-6">No teaching documents currently uploaded.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {resources.map(res => (
              <a 
                key={res.id} 
                href={res.url || '#'} 
                target="_blank" 
                rel="noreferrer" 
                className="group border border-gray-200/80 dark:border-slate-800 rounded-xl p-5 hover:border-brand-red transition-colors bg-gray-50/50 dark:bg-slate-950 flex items-start gap-4"
              >
                <div className="p-2.5 rounded-lg bg-brand-red/10 text-brand-red flex-shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-brand-red transition-colors">
                    {res.title || 'Curriculum Guide'}
                  </h3>
                  {res.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{res.description}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Send Class Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Post Live Class Link</h3>
            <p className="text-xs text-gray-500 mb-4">Broadcast a Zoom or Meet link directly to the student portal.</p>

            <form onSubmit={handlePostLink} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Select Cadet</label>
                <select 
                  required
                  value={targetStudentId}
                  onChange={e => setTargetStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.studentName || s.username} ({s.accessCode || 'No Code'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Session Title</label>
                <input 
                  type="text" 
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  placeholder="e.g. Python Loops & AI Logic Live Session" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Platform</label>
                <select 
                  value={linkPlatform}
                  onChange={e => setLinkPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs"
                >
                  <option value="Google Meet">Google Meet</option>
                  <option value="Zoom">Zoom Meeting</option>
                  <option value="Microsoft Teams">Microsoft Teams</option>
                  <option value="Scratch Live Lab">Scratch Live Lab</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Meeting URL</label>
                <input 
                  type="url" 
                  required
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Meeting Time / Date (Optional)</label>
                <input 
                  type="text" 
                  value={meetingTime}
                  onChange={e => setMeetingTime(e.target.value)}
                  placeholder="e.g. Today at 4:30 PM WAT" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingLink}
                  className="px-4 py-2 bg-brand-red text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  {submittingLink ? 'Publishing...' : 'Publish to Student Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffDashboard;
