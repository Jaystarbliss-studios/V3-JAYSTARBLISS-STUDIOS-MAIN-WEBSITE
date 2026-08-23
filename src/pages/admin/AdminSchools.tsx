import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc,
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  School, Key, BookOpen, Plus, Trash2, 
  ExternalLink, Lock, FileText
} from 'lucide-react';

const AFFILIATED_SCHOOLS = [
  { id: 'peniel', name: 'Peniel Lily Montessori School', icon: '🎓', defaultCode: 'PENIEL2026' },
  { id: 'southgold', name: 'South Gold Montessori School', icon: '🏆', defaultCode: 'SOUTHGOLD2026' },
  { id: 'sapphire', name: 'Sapphire Explorer Montessori School', icon: '💎', defaultCode: 'SAPPHIRE2026' },
  { id: 'easystars', name: 'Easy Stars Early Years Academy', icon: '⭐', defaultCode: 'EASYSTARS2026' },
  { id: 'christycaleb', name: 'Christy Caleb International School', icon: '📚', defaultCode: 'CHRISTY2026' },
  { id: 'royalbreed', name: 'Royal Breed Academy', icon: '👑', defaultCode: 'ROYAL2026' },
];

const AdminSchools: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'accessCodes' | 'schoolResources' | 'schoolExams'>('accessCodes');
  const [loading, setLoading] = useState(true);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');

  // School Access Codes Map: schoolId -> code
  const [schoolCodes, setSchoolCodes] = useState<Record<string, string>>({});
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [updatingCodeId, setUpdatingCodeId] = useState<string | null>(null);

  // School Resources & Links
  const [schoolResources, setSchoolResources] = useState<any[]>([]);
  const [resForm, setResForm] = useState({
    schoolId: 'peniel',
    type: 'resource',
    title: '',
    url: '',
    description: ''
  });
  const [resSubmitting, setResSubmitting] = useState(false);

  // School Exams
  const [schoolExams, setSchoolExams] = useState<any[]>([]);
  const [examForm, setExamForm] = useState({
    schoolId: 'peniel',
    title: '',
    url: '',
    description: ''
  });
  const [examSubmitting, setExamSubmitting] = useState(false);

  // Load all school data
  const fetchSchoolData = async () => {
    setLoading(true);
    try {
      // 1. Fetch access codes
      const codesMap: Record<string, string> = {};
      const inputsMap: Record<string, string> = {};

      for (const s of AFFILIATED_SCHOOLS) {
        try {
          const sDoc = await getDoc(doc(db, 'schools', s.id));
          if (sDoc.exists() && sDoc.data().accessCode) {
            codesMap[s.id] = sDoc.data().accessCode;
            inputsMap[s.id] = sDoc.data().accessCode;
          } else {
            codesMap[s.id] = s.defaultCode;
            inputsMap[s.id] = s.defaultCode;
            // Seed default if not existing
            await setDoc(doc(db, 'schools', s.id), {
              name: s.name,
              accessCode: s.defaultCode,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        } catch {
          codesMap[s.id] = s.defaultCode;
          inputsMap[s.id] = s.defaultCode;
        }
      }
      setSchoolCodes(codesMap);
      setCodeInputs(inputsMap);

      // 2. Fetch School Resources and Links
      const [rSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'schoolResources'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolResources'))),
        getDocs(query(collection(db, 'schoolLinks'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolLinks')))
      ]);

      const mergedRes: any[] = [];
      rSnap.forEach(d => mergedRes.push({ id: d.id, collectionName: 'schoolResources', kind: 'resource', ...d.data() }));
      lSnap.forEach(d => mergedRes.push({ id: d.id, collectionName: 'schoolLinks', kind: 'link', ...d.data() }));
      mergedRes.sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate() : 0));
      setSchoolResources(mergedRes);

      // 3. Fetch School Exams
      const eSnap = await getDocs(query(collection(db, 'schoolExams'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'schoolExams')));
      setSchoolExams(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err: any) {
      console.error('Error fetching school data:', err);
      toast.error('Failed to load affiliated schools data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolData();
  }, []);

  // Update Access Code
  const handleUpdateAccessCode = async (schoolId: string) => {
    const code = codeInputs[schoolId]?.trim();
    if (!code) {
      toast.error('Access code cannot be empty.');
      return;
    }
    setUpdatingCodeId(schoolId);
    try {
      await setDoc(doc(db, 'schools', schoolId), {
        accessCode: code,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setSchoolCodes(prev => ({ ...prev, [schoolId]: code }));
      toast.success(`Access code for ${getSchoolName(schoolId)} updated to: ${code}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update access code: ' + err.message);
    } finally {
      setUpdatingCodeId(null);
    }
  };

  // Post School Resource / Link
  const handlePostSchoolResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim() || !resForm.url.trim()) {
      toast.error('Please enter a title and file/link URL.');
      return;
    }
    setResSubmitting(true);
    const collectionName = resForm.type === 'link' ? 'schoolLinks' : 'schoolResources';
    const urlKey = resForm.type === 'link' ? 'url' : 'fileUrl';

    try {
      await addDoc(collection(db, collectionName), {
        schoolId: resForm.schoolId,
        title: resForm.title.trim(),
        [urlKey]: resForm.url.trim(),
        description: resForm.description.trim(),
        timestamp: serverTimestamp()
      });

      toast.success(`Dispatched ${resForm.type} to ${getSchoolName(resForm.schoolId)}!`);
      setResForm({ schoolId: resForm.schoolId, type: 'resource', title: '', url: '', description: '' });
      fetchSchoolData();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setResSubmitting(false);
    }
  };

  // Post School Exam
  const handlePostSchoolExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.title.trim() || !examForm.url.trim()) {
      toast.error('Please enter an exam title and Google Forms link.');
      return;
    }
    setExamSubmitting(true);
    try {
      await addDoc(collection(db, 'schoolExams'), {
        schoolId: examForm.schoolId,
        title: examForm.title.trim(),
        url: examForm.url.trim(),
        description: examForm.description.trim(),
        timestamp: serverTimestamp()
      });

      toast.success(`School exam published for ${getSchoolName(examForm.schoolId)}!`);
      setExamForm({ schoolId: examForm.schoolId, title: '', url: '', description: '' });
      fetchSchoolData();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setExamSubmitting(false);
    }
  };

  // Delete Resource or Exam
  const handleDeleteItem = async (id: string, colName: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, colName, id));
      toast.success(`Deleted "${title}".`);
      fetchSchoolData();
    } catch (err: any) {
      toast.error('Failed to delete item: ' + err.message);
    }
  };

  const getSchoolName = (id: string) => {
    const s = AFFILIATED_SCHOOLS.find(item => item.id === id);
    return s ? s.name : id;
  };

  const filteredResources = schoolResources.filter(r => 
    selectedSchoolFilter === 'all' || r.schoolId === selectedSchoolFilter
  );

  const filteredExams = schoolExams.filter(e => 
    selectedSchoolFilter === 'all' || e.schoolId === selectedSchoolFilter
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
            <School className="text-brand-red w-8 h-8" />
            Affiliated Schools Command
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage authentication passcodes, curriculum dispatches, and online examination portals across all 6 partner institutions.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter School:</span>
          <select
            value={selectedSchoolFilter}
            onChange={(e) => setSelectedSchoolFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
          >
            <option value="all">All 6 Affiliated Schools</option>
            {AFFILIATED_SCHOOLS.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('accessCodes')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'accessCodes'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Lock size={17} />
          <span>School Access Codes ({AFFILIATED_SCHOOLS.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schoolResources')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'schoolResources'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <BookOpen size={17} />
          <span>School Resources &amp; Links ({schoolResources.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('schoolExams')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'schoolExams'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FileText size={17} />
          <span>School-Specific Exams ({schoolExams.length})</span>
        </button>
      </div>

      {/* ══ TAB 1: SCHOOL ACCESS CODES ══ */}
      {activeTab === 'accessCodes' && (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <Key size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Institutional Access Security:</strong> Students and staff attending affiliated schools must enter these passcode tokens to enter their respective institutional portals. You can rotate and update them instantly at any time.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AFFILIATED_SCHOOLS.map((school) => {
              const currentCode = schoolCodes[school.id] || school.defaultCode;
              const isUpdating = updatingCodeId === school.id;

              return (
                <div 
                  key={school.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{school.icon}</span>
                      <div>
                        <h3 className="font-extrabold text-sm text-gray-900 dark:text-white leading-snug">
                          {school.name}
                        </h3>
                        <span className="text-[11px] font-mono text-gray-400">ID: {school.id}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-700/60 mb-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                        Active Portal Passcode:
                      </div>
                      <div className="text-lg font-black font-mono tracking-wider text-brand-red">
                        {currentCode}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">
                      Update Access Code:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codeInputs[school.id] || ''}
                        onChange={(e) => setCodeInputs({ ...codeInputs, [school.id]: e.target.value.toUpperCase() })}
                        placeholder="ENTER_NEW_CODE"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-brand-red"
                      />
                      <button
                        onClick={() => handleUpdateAccessCode(school.id)}
                        disabled={isUpdating}
                        className="px-3.5 py-2 bg-brand-slate dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shrink-0 disabled:opacity-50"
                      >
                        {isUpdating ? 'Saving...' : 'Update'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TAB 2: SCHOOL RESOURCES & LINKS ══ */}
      {activeTab === 'schoolResources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus size={18} className="text-brand-red" />
              Deploy School Resource
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Upload institutional files and lecture guides restricted to students enrolled in a specific Montessori or Partner School.
            </p>

            <form onSubmit={handlePostSchoolResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Affiliated School *
                </label>
                <select
                  value={resForm.schoolId}
                  onChange={(e) => setResForm({ ...resForm, schoolId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  {AFFILIATED_SCHOOLS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Resource Type
                </label>
                <select
                  value={resForm.type}
                  onChange={(e) => setResForm({ ...resForm, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="resource">📄 File / Document (Google Drive / PDF)</option>
                  <option value="link">🔗 Platform Link / Interactive Tool</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={resForm.title}
                  onChange={(e) => setResForm({ ...resForm, title: e.target.value })}
                  placeholder="e.g. Grade 4 Scratch Programming Lab Work"
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
                  value={resForm.url}
                  onChange={(e) => setResForm({ ...resForm, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={resForm.description}
                  onChange={(e) => setResForm({ ...resForm, description: e.target.value })}
                  placeholder="Instructions for the school facilitator and students..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={resSubmitting}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {resSubmitting ? 'Posting...' : 'Dispatch to School'}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              School Resources &amp; Materials ({filteredResources.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading materials...</div>
            ) : filteredResources.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No materials found for the selected school filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredResources.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 truncate max-w-[190px]">
                          {getSchoolName(item.schoolId)}
                        </span>
                        <button
                          onClick={() => handleDeleteItem(item.id, item.collectionName, item.title)}
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

      {/* ══ TAB 3: SCHOOL EXAMS ══ */}
      {activeTab === 'schoolExams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus size={18} className="text-brand-red" />
              Deploy School Exam
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Publish school-specific termly assessments and coding practicals visible only inside the target school's terminal.
            </p>

            <form onSubmit={handlePostSchoolExam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Affiliated School *
                </label>
                <select
                  value={examForm.schoolId}
                  onChange={(e) => setExamForm({ ...examForm, schoolId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  {AFFILIATED_SCHOOLS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  placeholder="e.g. End of Term 2 Robotics Practical"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Exam Link (Google Forms / Typeform) *
                </label>
                <input
                  type="url"
                  required
                  value={examForm.url}
                  onChange={(e) => setExamForm({ ...examForm, url: e.target.value })}
                  placeholder="https://forms.google.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Instructions & Guidelines
                </label>
                <textarea
                  rows={3}
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  placeholder="Instructions for invigilators and pupils..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={examSubmitting}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {examSubmitting ? 'Posting...' : 'Deploy School Exam'}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Active School Exams ({filteredExams.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading exams...</div>
            ) : filteredExams.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No exams found for the selected school filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredExams.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-red/10 text-brand-red truncate max-w-[190px]">
                          {getSchoolName(item.schoolId)}
                        </span>
                        <button
                          onClick={() => handleDeleteItem(item.id, 'schoolExams', item.title)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete Exam"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="font-black text-gray-900 dark:text-white text-base leading-snug mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 leading-relaxed">
                        {item.description || 'Instructions provided within the examination link.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                      >
                        <ExternalLink size={14} /> Open Examination Form
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

export default AdminSchools;
