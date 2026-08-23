import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, setDoc, 
  query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  Users, UserPlus, Send, Trash2, Search, 
  ExternalLink, Mail, Sparkles
} from 'lucide-react';

const AdminStudents: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'manage' | 'sendResource'>('manage');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Student list
  const [students, setStudents] = useState<any[]>([]);
  
  // Add Student Form
  const [newStudent, setNewStudent] = useState({
    fullName: '',
    username: '',
    email: '',
    accessCode: '',
    subjects: 'Coding, Mathematics'
  });
  const [addingStudent, setAddingStudent] = useState(false);

  // Edit Code State
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [tempCode, setTempCode] = useState('');

  // Send Personal Resource Form
  const [personalForm, setPersonalForm] = useState({
    targetStudentId: '',
    type: 'resource',
    title: '',
    url: '',
    description: ''
  });
  const [sendingPersonal, setSendingPersonal] = useState(false);
  const [personalDispatches, setPersonalDispatches] = useState<any[]>([]);

  // Fetch all students & dispatches
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch individualStudents
      const snap = await getDocs(query(collection(db, 'individualStudents'), orderBy('registeredAt', 'desc'))).catch(() => getDocs(collection(db, 'individualStudents')));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(list);

      // Fetch Personal Resources & Links
      const [rSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'personalResources'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'personalResources'))),
        getDocs(query(collection(db, 'personalLinks'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'personalLinks')))
      ]);

      const merged: any[] = [];
      rSnap.forEach(d => merged.push({ id: d.id, collectionName: 'personalResources', kind: 'resource', ...d.data() }));
      lSnap.forEach(d => merged.push({ id: d.id, collectionName: 'personalLinks', kind: 'link', ...d.data() }));
      merged.sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate() : 0));
      setPersonalDispatches(merged);

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load students data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Generate unique access code
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const code = Array.from(arr, b => chars[b % chars.length]).join('');
    setNewStudent(prev => ({ ...prev, accessCode: code }));
  };

  // Add new student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName.trim() || !newStudent.username.trim() || !newStudent.accessCode.trim()) {
      toast.error('Please fill in student name, username, and access code.');
      return;
    }
    setAddingStudent(true);
    try {
      const cleanUsername = newStudent.username.trim().toLowerCase().replace(/\s+/g, '');
      const existing = await getDocs(query(collection(db, 'individualStudents'), where('username', '==', cleanUsername)));
      if (!existing.empty) {
        toast.error(`Username @${cleanUsername} is already taken. Please choose another.`);
        setAddingStudent(false);
        return;
      }

      const subjectsArr = newStudent.subjects.split(',').map(s => s.trim()).filter(Boolean);

      await addDoc(collection(db, 'individualStudents'), {
        fullName: newStudent.fullName.trim(),
        username: cleanUsername,
        email: newStudent.email.trim().toLowerCase(),
        accessCode: newStudent.accessCode.trim().toUpperCase(),
        subjects: subjectsArr,
        status: 'ACTIVE',
        registeredAt: serverTimestamp()
      });

      toast.success(`Student ${newStudent.fullName} created! Access Code: ${newStudent.accessCode.toUpperCase()}`);
      setNewStudent({ fullName: '', username: '', email: '', accessCode: '', subjects: 'Coding, Mathematics' });
      fetchData();
    } catch (err: any) {
      toast.error('Error creating student: ' + err.message);
    } finally {
      setAddingStudent(false);
    }
  };

  // Update Access Code
  const handleUpdateCode = async (studentId: string) => {
    if (!tempCode.trim()) {
      toast.error('Access code cannot be blank.');
      return;
    }
    try {
      await setDoc(doc(db, 'individualStudents', studentId), {
        accessCode: tempCode.trim().toUpperCase()
      }, { merge: true });

      toast.success(`Access code updated to ${tempCode.trim().toUpperCase()}!`);
      setEditingCodeId(null);
      setTempCode('');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update code: ' + err.message);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete student "${studentName}" and all their assigned resources?`)) return;
    try {
      await deleteDoc(doc(db, 'individualStudents', studentId));

      // Also clean up personal resources and links
      const [rSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'personalResources'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'personalLinks'), where('studentId', '==', studentId)))
      ]);

      const deletions: Promise<void>[] = [];
      rSnap.forEach(d => deletions.push(deleteDoc(d.ref)));
      lSnap.forEach(d => deletions.push(deleteDoc(d.ref)));
      await Promise.all(deletions);

      toast.success(`Student "${studentName}" and personal files deleted.`);
      fetchData();
    } catch (err: any) {
      toast.error('Error deleting student: ' + err.message);
    }
  };

  // Send Personal Resource / Link
  const handleSendPersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalForm.targetStudentId || !personalForm.title.trim() || !personalForm.url.trim()) {
      toast.error('Please choose a student, enter a title, and provide the link URL.');
      return;
    }
    setSendingPersonal(true);
    const collectionName = personalForm.type === 'link' ? 'personalLinks' : 'personalResources';
    const urlKey = personalForm.type === 'link' ? 'url' : 'fileUrl';

    try {
      await addDoc(collection(db, collectionName), {
        studentId: personalForm.targetStudentId,
        title: personalForm.title.trim(),
        [urlKey]: personalForm.url.trim(),
        description: personalForm.description.trim(),
        timestamp: serverTimestamp()
      });

      const studentObj = students.find(s => s.id === personalForm.targetStudentId);
      toast.success(`Transmitted ${personalForm.type} directly to ${studentObj?.fullName || 'student'}!`);
      setPersonalForm({ targetStudentId: '', type: 'resource', title: '', url: '', description: '' });
      fetchData();
    } catch (err: any) {
      toast.error('Error sending resource: ' + err.message);
    } finally {
      setSendingPersonal(false);
    }
  };

  // Delete Personal Resource
  const handleDeletePersonalResource = async (id: string, collectionName: string, title: string) => {
    if (!window.confirm(`Delete personal dispatch "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success(`Deleted "${title}".`);
      fetchData();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const getStudentName = (id: string) => {
    const s = students.find(item => item.id === id);
    return s ? (s.fullName || s.username) : 'Unknown Scholar';
  };

  const filteredStudents = students.filter(s => 
    s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
            <Users className="text-brand-red w-8 h-8" />
            Scholars &amp; Student Operations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Provision individual student portal credentials, rotate access keys, and transmit customized learning tracks.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
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
          <UserPlus size={17} />
          <span>Manage Students ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sendResource')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'sendResource'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Send size={17} />
          <span>Send Personal Resources ({personalDispatches.length})</span>
        </button>
      </div>

      {/* ══ TAB 1: MANAGE STUDENTS ══ */}
      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Student Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <UserPlus size={18} className="text-brand-red" />
              Register New Student
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Create a personalized portal account for private and enrolled scholars with custom subjects and security code.
            </p>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                  placeholder="e.g. David Alabi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Unique Username *
                </label>
                <input
                  type="text"
                  required
                  value={newStudent.username}
                  onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  placeholder="e.g. davidalabi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  placeholder="student@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    Portal Access Code *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="text-[11px] font-bold text-brand-red hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newStudent.accessCode}
                  onChange={(e) => setNewStudent({ ...newStudent, accessCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. JDH9482"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Enrolled Subjects (Comma-separated)
                </label>
                <input
                  type="text"
                  value={newStudent.subjects}
                  onChange={(e) => setNewStudent({ ...newStudent, subjects: e.target.value })}
                  placeholder="Coding, Python, Mathematics, Robotics"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <button
                type="submit"
                disabled={addingStudent}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {addingStudent ? 'Provisioning...' : 'Add Student Account'}
              </button>
            </form>
          </div>

          {/* Student List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Registered Students ({filteredStudents.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading scholars...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No students found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStudents.map((student) => {
                  const isEditing = editingCodeId === student.id;

                  return (
                    <div 
                      key={student.id} 
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-slate-700 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-mono text-gray-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            @{student.username}
                          </span>
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.fullName || student.username)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete Student"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <h3 className="font-black text-gray-900 dark:text-white text-base leading-snug mb-1">
                          {student.fullName || student.username}
                        </h3>

                        {student.email && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2">
                            <Mail size={12} /> {student.email}
                          </div>
                        )}

                        <div className="my-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                          <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                            Access Code:
                          </div>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tempCode}
                                onChange={(e) => setTempCode(e.target.value.toUpperCase())}
                                className="px-2 py-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded font-mono font-bold text-xs flex-1 text-brand-red"
                              />
                              <button
                                onClick={() => handleUpdateCode(student.id)}
                                className="px-2.5 py-1 bg-brand-red text-white rounded text-[11px] font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCodeId(null)}
                                className="px-2 py-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-base font-black font-mono tracking-wider text-brand-red">
                                {student.accessCode || 'NO_CODE'}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingCodeId(student.id);
                                  setTempCode(student.accessCode || '');
                                }}
                                className="text-[11px] font-bold text-gray-500 hover:text-brand-slate dark:hover:text-white underline"
                              >
                                Change
                              </button>
                            </div>
                          )}
                        </div>

                        {student.subjects && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {(Array.isArray(student.subjects) ? student.subjects : student.subjects.split(',')).map((sub: string, i: number) => (
                              <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {sub.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Enrolled Track</span>
                        <span className="font-mono">{student.registeredAt?.toDate ? student.registeredAt.toDate().toLocaleDateString() : 'Active'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB 2: SEND PERSONAL RESOURCES ══ */}
      {activeTab === 'sendResource' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Send Resource Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Send size={18} className="text-brand-red" />
              Transmit Personal Resource
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Send personalized homework assignments, code repositories, or feedback documents directly to a specific scholar's dashboard.
            </p>

            <form onSubmit={handleSendPersonal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Target Student *
                </label>
                <select
                  required
                  value={personalForm.targetStudentId}
                  onChange={(e) => setPersonalForm({ ...personalForm, targetStudentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="">Select Student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.username} (@{s.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Resource Type
                </label>
                <select
                  value={personalForm.type}
                  onChange={(e) => setPersonalForm({ ...personalForm, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="resource">📄 File / Document (PDF, Drive, Dropbox)</option>
                  <option value="link">🔗 Interactive Link / Live Workspace</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={personalForm.title}
                  onChange={(e) => setPersonalForm({ ...personalForm, title: e.target.value })}
                  placeholder="e.g. Python Capstone Project Task Brief"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  URL / Share Link *
                </label>
                <input
                  type="url"
                  required
                  value={personalForm.url}
                  onChange={(e) => setPersonalForm({ ...personalForm, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Personal Instructions
                </label>
                <textarea
                  rows={3}
                  value={personalForm.description}
                  onChange={(e) => setPersonalForm({ ...personalForm, description: e.target.value })}
                  placeholder="Custom notes and milestone requirements for this student..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={sendingPersonal}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {sendingPersonal ? 'Transmitting...' : 'Dispatch to Scholar Portal'}
              </button>
            </form>
          </div>

          {/* Dispatches List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Recently Dispatched Resources ({personalDispatches.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading dispatches...</div>
            ) : personalDispatches.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No personal resources have been dispatched yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personalDispatches.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 truncate max-w-[190px]">
                          👤 {getStudentName(item.studentId)}
                        </span>
                        <button
                          onClick={() => handleDeletePersonalResource(item.id, item.collectionName, item.title)}
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
                        {item.description || 'Personal homework material.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={item.url || item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                      >
                        <ExternalLink size={14} /> Open Material
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
    </div>
  );
};

export default AdminStudents;
