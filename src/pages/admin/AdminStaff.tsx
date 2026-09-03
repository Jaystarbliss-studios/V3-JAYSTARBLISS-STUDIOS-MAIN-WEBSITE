import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, 
  query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import StaffSchoolAssignments from './StaffSchoolAssignments';
import { 
  UserCheck, Key, Plus, Trash2, 
  ExternalLink, Mail, BookOpen, 
  Copy, Briefcase, ShieldBan, ShieldCheck
} from 'lucide-react';

const AdminStaff: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'manage' | 'resources' | 'schoolAccess'>('manage');
  const [loading, setLoading] = useState(true);

  // Staff members
  const [staffList, setStaffList] = useState<any[]>([]);

  // Invite Form

  // Staff Resources
  const [staffResources, setStaffResources] = useState<any[]>([]);
  const [resForm, setResForm] = useState({
    title: '',
    url: '',
    description: ''
  });
  const [postingResource, setPostingResource] = useState(false);

  // Staff School Access Code
  const [currentStaffSchoolCode, setCurrentStaffSchoolCode] = useState('STAFF_JDH_2026');
  const [newStaffSchoolCode, setNewStaffSchoolCode] = useState('');
  const [updatingStaffSchoolCode, setUpdatingStaffSchoolCode] = useState(false);

  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch staff & tutor users
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['staff', 'tutor', 'STAFF', 'TUTOR', 'instructor'])));
      setStaffList(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. Fetch staff general resources
      const resSnap = await getDocs(query(collection(db, 'staffGeneralResources'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'staffGeneralResources')));
      setStaffResources(resSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 4. Fetch staff school access code
      try {
        const codeSnap = await getDoc(doc(db, 'staffSchoolAccess', 'accessCode'));
        if (codeSnap.exists() && codeSnap.data().code) {
          setCurrentStaffSchoolCode(codeSnap.data().code);
          setNewStaffSchoolCode(codeSnap.data().code);
        } else {
          await setDoc(doc(db, 'staffSchoolAccess', 'accessCode'), { code: 'STAFF_JDH_2026', updatedAt: serverTimestamp() });
          setCurrentStaffSchoolCode('STAFF_JDH_2026');
          setNewStaffSchoolCode('STAFF_JDH_2026');
        }
      } catch (e) {
        console.warn(e);
      }

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load staff operations data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const updateStaffAccountStatus = async (id: string, name: string, nextStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DISABLED') => {
    const action = nextStatus === 'ACTIVE' ? 'restore' : nextStatus === 'SUSPENDED' ? 'suspend' : nextStatus === 'BANNED' ? 'ban' : 'disable';
    if (!window.confirm(`Are you sure you want to ${action} "${name}"?`)) return;
    try {
      if (!auth.currentUser) throw new Error('Your admin session has expired. Please sign in again.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/admin-account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: id, status: nextStatus })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to update account access securely.');
      setStaffList(prev => prev.map(member => member.id === id ? { ...member, accountStatus: nextStatus } : member));
      toast.success(`${name} is now ${nextStatus.toLowerCase()}.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update account status: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    await updateStaffAccountStatus(id, name, 'DISABLED');
  };

  const handleAccountStatus = async (id: string, name: string, nextStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    await updateStaffAccountStatus(id, name, nextStatus);
  };

  // Post Staff Resource
  const handlePostStaffResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim() || !resForm.url.trim()) {
      toast.error('Please enter a resource title and URL.');
      return;
    }
    setPostingResource(true);
    try {
      await addDoc(collection(db, 'staffGeneralResources'), {
        title: resForm.title.trim(),
        url: resForm.url.trim(),
        description: resForm.description.trim(),
        timestamp: serverTimestamp()
      });

      toast.success(`Staff guide "${resForm.title}" published!`);
      setResForm({ title: '', url: '', description: '' });
      fetchStaffData();
    } catch (err: any) {
      toast.error('Error posting resource: ' + err.message);
    } finally {
      setPostingResource(false);
    }
  };

  // Delete Staff Resource
  const handleDeleteStaffResource = async (id: string, title: string) => {
    if (!window.confirm(`Delete staff resource "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'staffGeneralResources', id));
      toast.success(`Deleted "${title}".`);
      fetchStaffData();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  // Update Staff School Access Code
  const handleUpdateStaffSchoolCode = async () => {
    if (!newStaffSchoolCode.trim()) {
      toast.error('Access code cannot be blank.');
      return;
    }
    setUpdatingStaffSchoolCode(true);
    try {
      await setDoc(doc(db, 'staffSchoolAccess', 'accessCode'), {
        code: newStaffSchoolCode.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      setCurrentStaffSchoolCode(newStaffSchoolCode.trim());
      toast.success(`Staff School Access Passcode updated to: ${newStaffSchoolCode.trim()}`);
    } catch (err: any) {
      toast.error('Failed to update access code: ' + err.message);
    } finally {
      setUpdatingStaffSchoolCode(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
            <Briefcase className="text-brand-red w-8 h-8" />
            Staff &amp; Faculty Operations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage instructor onboarding, staff teaching curricula, and school portal dispatch passcodes.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('manage')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'manage'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <UserCheck size={17} />
          <span>Staff Directory ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'resources'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <BookOpen size={17} />
          <span>Staff Resources &amp; Guides ({staffResources.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schoolAccess')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'schoolAccess'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Key size={17} />
          <span>Staff School Access Code</span>
        </button>
      </div>

      {/* ══ TAB 1: MANAGE STAFF & INVITATIONS ══ */}
      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Staff onboarding is centralized in Users & Roles Management. */}
          <div className="lg:col-span-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Staff Onboarding</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">Staff and tutors are now provisioned through the secure Users &amp; Roles workflow. This removes the retired shared registration passcode and ensures each account receives its own Firebase credentials and audit trail.</p>
            <a href="/admin/users" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700">Open Users &amp; Roles</a>
          </div>
          {/* Staff Members List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Registered Faculty &amp; Staff ({staffList.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading faculty members...</div>
            ) : staffList.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No staff members registered yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staffList.map((staff) => (
                  <div 
                    key={staff.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {staff.role || 'STAFF'}
                        </span>
                        <button
                          onClick={() => handleDeleteStaff(staff.id, staff.name || staff.email)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Remove Staff"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="font-black text-gray-900 dark:text-white text-base leading-snug mb-1">
                        {staff.name || staff.fullName || 'Faculty Member'}
                      </h3>

                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                        <Mail size={12} /> {staff.email}
                      </div>

                      {staff.phone && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono">
                          {staff.phone}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${
                        String(staff.accountStatus || 'ACTIVE').toUpperCase() === 'BANNED'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : String(staff.accountStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>{String(staff.accountStatus || 'ACTIVE')}</span>
                      <div className="flex gap-1.5 ml-auto">
                        {String(staff.accountStatus || 'ACTIVE').toUpperCase() !== 'SUSPENDED' && <button onClick={() => handleAccountStatus(staff.id, staff.name || staff.email, 'SUSPENDED')} className="px-2 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 text-[10px] font-bold"><ShieldBan size={12} className="inline mr-1" />Suspend</button>}
                        {String(staff.accountStatus || 'ACTIVE').toUpperCase() !== 'BANNED' && <button onClick={() => handleAccountStatus(staff.id, staff.name || staff.email, 'BANNED')} className="px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-[10px] font-bold"><ShieldBan size={12} className="inline mr-1" />Ban</button>}
                        {String(staff.accountStatus || 'ACTIVE').toUpperCase() !== 'ACTIVE' && <button onClick={() => handleAccountStatus(staff.id, staff.name || staff.email, 'ACTIVE')} className="px-2 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[10px] font-bold"><ShieldCheck size={12} className="inline mr-1" />Restore</button>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-gray-400">
                      <span>Onboarded</span>
                      <span className="font-mono">{staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString() : 'Active'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB 2: STAFF RESOURCES ══ */}
      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus size={18} className="text-brand-red" />
              Add Staff Guide &amp; Curriculum
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Upload teaching lesson plans, grading rubrics, and faculty training documents visible across all staff terminals.
            </p>

            <form onSubmit={handlePostStaffResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={resForm.title}
                  onChange={(e) => setResForm({ ...resForm, title: e.target.value })}
                  placeholder="e.g. 2026 Coding Curriculum Master Guide"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  File URL / Google Drive Link *
                </label>
                <input
                  type="url"
                  required
                  value={resForm.url}
                  onChange={(e) => setResForm({ ...resForm, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Description &amp; Guidelines
                </label>
                <textarea
                  rows={3}
                  value={resForm.description}
                  onChange={(e) => setResForm({ ...resForm, description: e.target.value })}
                  placeholder="Faculty guidelines, grading criteria, and instructions..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={postingResource}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {postingResource ? 'Publishing...' : 'Publish to Faculty Hub'}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Faculty Resources ({staffResources.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading guides...</div>
            ) : staffResources.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No staff resources posted yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staffResources.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          FACULTY GUIDE
                        </span>
                        <button
                          onClick={() => handleDeleteStaffResource(item.id, item.title)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="font-black text-gray-900 dark:text-white text-base leading-snug mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 leading-relaxed">
                        {item.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                      >
                        <ExternalLink size={14} /> Open Guide
                      </a>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB 3: STAFF SCHOOL ACCESS ══ */}
      {activeTab === 'schoolAccess' && (
        <StaffSchoolAssignments />
      )}
    </div>
  );
};

export default AdminStaff;
