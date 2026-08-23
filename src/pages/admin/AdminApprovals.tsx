import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { 
  CheckCircle2, XCircle, Clock, ExternalLink, Award, DollarSign, 
  Calendar, Phone, Mail, Eye
} from 'lucide-react';

const AdminApprovals: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'tutors' | 'enrollments'>('tutors');
  const [studentReqs, setStudentReqs] = useState<any[]>([]);
  const [tutorReqs, setTutorReqs] = useState<any[]>([]);
  const [enrollmentReqs, setEnrollmentReqs] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedTutorDetail, setSelectedTutorDetail] = useState<any | null>(null);

  useEffect(() => {
    // Fetch pending student requests
    const qStudents = query(collection(db, 'student_requests'), where('status', '==', 'pending'));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStudentReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qTutors = query(collection(db, 'tutor_applications'), where('status', '==', 'pending'));
    const unsubTutors = onSnapshot(qTutors, (snap) => {
      setTutorReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qEnrollments = query(collection(db, 'enrollment_requests'), where('status', '==', 'pending'));
    const unsubEnrollments = onSnapshot(qEnrollments, (snap) => {
      setEnrollmentReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStudents();
      unsubTutors();
      unsubEnrollments();
    };
  }, []);

  const generateAccessCode = (length = 7) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => chars[b % chars.length]).join('');
  };

  const approveStudent = async (req: any) => {
    if (!window.confirm(`Approve student ${req.name}?`)) return;
    setLoadingId(req.id);
    try {
      const accessCode = generateAccessCode();
      const subjects = Array.isArray(req.subjects) ? req.subjects : (req.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      
      await addDoc(collection(db, 'students'), {
        fullName: req.name,
        username: (req.email || req.name).split('@')[0].replace(/\s+/g,'').toLowerCase(),
        email: (req.email || '').toLowerCase(),
        phone: req.phone || '',
        parentPhone: req.parentPhone || '',
        grade: req.class || 'Cadet',
        accessCode,
        parentId: req.parentId || null,
        subjects,
        registeredAt: serverTimestamp()
      });

      // Also ensure individualStudents collection compatibility
      await addDoc(collection(db, 'individualStudents'), {
        fullName: req.name,
        username: (req.email || req.name).split('@')[0].replace(/\s+/g,'').toLowerCase(),
        email: (req.email || '').toLowerCase(),
        accessCode,
        subjects,
        status: 'ACTIVE',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'student_requests', req.id), {
        status: 'approved',
        accessCode,
        approvedAt: serverTimestamp()
      });
      alert(`Student Approved! Generated Student Access code: ${accessCode}`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  const approveTutor = async (req: any) => {
    if (!window.confirm(`Approve tutor ${req.name} and grant instructor permissions?`)) return;
    setLoadingId(req.id);
    try {
      const subjects = Array.isArray(req.subjects) ? req.subjects : (req.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      
      // Add or set tutor document
      await setDoc(doc(db, 'tutors', req.id), {
        name: req.name,
        email: req.email?.toLowerCase(),
        phone: req.phone || '',
        location: req.location || '',
        qualification: req.qualification || '',
        cvUrl: req.cvUrl || '',
        subjects,
        experienceYears: req.experienceYears || '1–3 Years',
        daysPerWeek: req.daysPerWeek || '',
        timeSlot: req.timeSlot || '',
        expectedSalary: req.expectedSalary || '',
        bio: req.bio || '',
        role: 'tutor',
        status: 'ACTIVE',
        createdAt: serverTimestamp()
      });

      // Mark application as approved
      await updateDoc(doc(db, 'tutor_applications', req.id), {
        status: 'approved',
        approvedAt: serverTimestamp()
      });

      if (selectedTutorDetail?.id === req.id) {
        setSelectedTutorDetail(null);
      }

      alert(`Tutor ${req.name} has been approved into the instructional faculty!`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  const rejectRequest = async (collectionName: string, id: string) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    setLoadingId(id);
    try {
      await updateDoc(doc(db, collectionName, id), {
        status: 'rejected',
        rejectedAt: serverTimestamp()
      });
      if (selectedTutorDetail?.id === id) {
        setSelectedTutorDetail(null);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Approvals & Onboarding</h1>
          <p className="text-xs text-gray-500 mt-0.5">Review incoming tutor applications, student enrollment requests, and program leads.</p>
        </div>
      </div>
      
      <div className="flex border-b border-gray-200 dark:border-slate-800 gap-2">
        <button
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'tutors' 
              ? 'border-brand-red text-brand-red bg-brand-red/5 dark:bg-brand-red/10 rounded-t-lg' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('tutors')}
        >
          <span>Tutor Applications</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-brand-red text-white">
            {tutorReqs.length}
          </span>
        </button>

        <button
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'students' 
              ? 'border-brand-red text-brand-red bg-brand-red/5 dark:bg-brand-red/10 rounded-t-lg' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('students')}
        >
          <span>Student Requests</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {studentReqs.length}
          </span>
        </button>

        <button
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'enrollments' 
              ? 'border-brand-red text-brand-red bg-brand-red/5 dark:bg-brand-red/10 rounded-t-lg' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('enrollments')}
        >
          <span>Course Enrollments</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {enrollmentReqs.length}
          </span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left">
          <thead className="bg-gray-50 dark:bg-slate-950">
            <tr>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Applicant / Name</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Tracks / Details</th>
              {activeTab === 'tutors' && (
                <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Availability & Rate</th>
              )}
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Applied Date</th>
              <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-sm">
            {/* TUTORS LIST */}
            {activeTab === 'tutors' && tutorReqs.map(req => (
              <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    {req.name}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Mail size={12} /> {req.email}
                  </div>
                  {req.phone && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {req.phone}
                    </div>
                  )}
                  {req.qualification && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-1">
                      <Award size={12} /> {req.qualification}
                    </div>
                  )}
                </td>

                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 mb-1.5 max-w-sm">
                    {Array.isArray(req.subjects) ? req.subjects.map((s: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-brand-red/10 text-brand-red text-[11px] font-bold rounded-md">
                        {s}
                      </span>
                    )) : req.subjects}
                  </div>
                  <div className="text-xs text-gray-500 max-w-xs line-clamp-2">
                    {req.bio || 'No bio provided.'}
                  </div>
                  {req.cvUrl && (
                    <a 
                      href={req.cvUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mt-1"
                    >
                      <ExternalLink size={12} /> View Portfolio / CV
                    </a>
                  )}
                </td>

                <td className="px-6 py-4">
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Calendar size={12} className="text-gray-400" />
                    {req.daysPerWeek || 'Not specified'}
                  </div>
                  {req.timeSlot && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock size={12} /> {req.timeSlot}
                    </div>
                  )}
                  {req.expectedSalary && (
                    <div className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                      <DollarSign size={12} /> {req.expectedSalary}
                    </div>
                  )}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                  {req.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <button 
                    onClick={() => setSelectedTutorDetail(req)}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-bold"
                    title="View Full Profile"
                  >
                    <Eye size={14} />
                  </button>
                  <button 
                    onClick={() => approveTutor(req)} 
                    disabled={loadingId === req.id} 
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button 
                    onClick={() => rejectRequest('tutor_applications', req.id)} 
                    disabled={loadingId === req.id} 
                    className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-all disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </td>
              </tr>
            ))}

            {/* STUDENTS LIST */}
            {activeTab === 'students' && studentReqs.map(req => (
              <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900 dark:text-white">{req.name}</div>
                  <div className="text-xs text-gray-500">{req.email}</div>
                  {req.phone && <div className="text-xs text-gray-500">Phone: {req.phone}</div>}
                  {req.parentPhone && <div className="text-xs text-gray-500">Parent: {req.parentPhone}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs font-bold text-brand-red mb-1">Class: {req.class || 'N/A'}</div>
                  <div className="text-xs text-gray-700 dark:text-gray-300">{Array.isArray(req.subjects) ? req.subjects.join(', ') : req.subjects}</div>
                  {req.notes && <div className="text-xs text-gray-400 mt-1 italic">"{req.notes}"</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                  {req.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <button 
                    onClick={() => approveStudent(req)} 
                    disabled={loadingId === req.id} 
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Approve & Issue Code
                  </button>
                  <button 
                    onClick={() => rejectRequest('student_requests', req.id)} 
                    disabled={loadingId === req.id} 
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}

            {/* ENROLLMENTS LIST */}
            {activeTab === 'enrollments' && enrollmentReqs.map(req => (
              <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900 dark:text-white">{req.studentName}</div>
                  <div className="text-xs text-gray-500">{req.studentEmail}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Plan: {req.plan}</div>
                  <div className="text-xs text-gray-500">Parent: {req.parentEmail}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                  {req.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <button 
                    onClick={() => rejectRequest('enrollment_requests', req.id)} 
                    disabled={loadingId === req.id} 
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}

            {/* EMPTY STATE */}
            {((activeTab === 'students' && studentReqs.length === 0) || 
              (activeTab === 'tutors' && tutorReqs.length === 0) || 
              (activeTab === 'enrollments' && enrollmentReqs.length === 0)) && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                    <CheckCircle2 size={32} className="text-green-500 mb-2" />
                    <p className="font-bold">No pending {activeTab} applications</p>
                    <p className="text-xs text-gray-400 mt-0.5">All incoming requests have been reviewed and processed.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FULL TUTOR DETAIL MODAL */}
      {selectedTutorDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-5 border border-gray-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Tutor Application: {selectedTutorDetail.name}
                </h3>
                <p className="text-xs text-gray-500">Full credentials and availability breakdown</p>
              </div>
              <button 
                onClick={() => setSelectedTutorDetail(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-gray-500 font-medium">Email:</span>
                <p className="font-bold text-gray-900 dark:text-white">{selectedTutorDetail.email}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-gray-500 font-medium">Phone:</span>
                <p className="font-bold text-gray-900 dark:text-white">{selectedTutorDetail.phone || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-gray-500 font-medium">Location:</span>
                <p className="font-bold text-gray-900 dark:text-white">{selectedTutorDetail.location || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-gray-500 font-medium">Qualification:</span>
                <p className="font-bold text-gray-900 dark:text-white">{selectedTutorDetail.qualification || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-gray-500 font-medium">Availability:</span>
                <p className="font-bold text-gray-900 dark:text-white">{selectedTutorDetail.daysPerWeek || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-gray-500 font-medium">Expected Rate:</span>
                <p className="font-bold text-green-600 dark:text-green-400">{selectedTutorDetail.expectedSalary || 'N/A'}</p>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                Instructional Tracks & Subjects:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Array.isArray(selectedTutorDetail.subjects) && selectedTutorDetail.subjects.map((s: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-bold rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {selectedTutorDetail.bio && (
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Bio / Teaching Philosophy:
                </span>
                <p className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {selectedTutorDetail.bio}
                </p>
              </div>
            )}

            {selectedTutorDetail.cvUrl && (
              <div>
                <a 
                  href={selectedTutorDetail.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-100"
                >
                  <ExternalLink size={14} /> Open Resume / Portfolio Document
                </a>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedTutorDetail(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-gray-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => approveTutor(selectedTutorDetail)}
                className="px-5 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700"
              >
                Approve Tutor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApprovals;
