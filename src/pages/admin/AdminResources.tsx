import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  FolderOpen, Link as LinkIcon, Plus, Trash2, 
  ExternalLink, Search, FileText, BookOpen
} from 'lucide-react';

const AdminResources: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'resources' | 'links' | 'exams'>('resources');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Resources state
  const [resources, setResources] = useState<any[]>([]);
  const [resForm, setResForm] = useState({
    title: '',
    category: 'both',
    description: '',
    fileUrl: ''
  });
  const [resSubmitting, setResSubmitting] = useState(false);

  // Links state
  const [links, setLinks] = useState<any[]>([]);
  const [linkForm, setLinkForm] = useState({
    title: '',
    category: 'both',
    url: '',
    description: ''
  });
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [previewLinkUrl, setPreviewLinkUrl] = useState('');

  // Exams state
  const [exams, setExams] = useState<any[]>([]);
  const [examForm, setExamForm] = useState({
    title: '',
    category: 'both',
    url: '',
    description: ''
  });
  const [examSubmitting, setExamSubmitting] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resSnap, linksSnap, examsSnap] = await Promise.all([
        getDocs(query(collection(db, 'resources'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'resources'))),
        getDocs(query(collection(db, 'links'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'links'))),
        getDocs(query(collection(db, 'exams'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'exams')))
      ]);

      setResources(resSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLinks(linksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setExams(examsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      console.error('Error loading resources:', err);
      toast.error('Failed to load learning resources.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Post Resource
  const handlePostResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim() || !resForm.fileUrl.trim()) {
      toast.error('Please enter a title and valid file URL.');
      return;
    }
    setResSubmitting(true);
    try {
      await addDoc(collection(db, 'resources'), {
        title: resForm.title.trim(),
        category: resForm.category,
        description: resForm.description.trim(),
        fileUrl: resForm.fileUrl.trim(),
        timestamp: serverTimestamp()
      });
      toast.success(`Resource "${resForm.title}" uploaded and published successfully!`);
      setResForm({ title: '', category: 'both', description: '', fileUrl: '' });
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error posting resource: ' + err.message);
    } finally {
      setResSubmitting(false);
    }
  };

  // Post Link
  const handlePostLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.title.trim() || !linkForm.url.trim()) {
      toast.error('Please enter a title and valid URL.');
      return;
    }
    setLinkSubmitting(true);
    try {
      await addDoc(collection(db, 'links'), {
        title: linkForm.title.trim(),
        category: linkForm.category,
        url: linkForm.url.trim(),
        description: linkForm.description.trim(),
        timestamp: serverTimestamp()
      });
      toast.success(`Link "${linkForm.title}" posted successfully!`);
      setLinkForm({ title: '', category: 'both', url: '', description: '' });
      setPreviewLinkUrl('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error posting link: ' + err.message);
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Post Exam
  const handlePostExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.title.trim() || !examForm.url.trim()) {
      toast.error('Please enter an exam title and link.');
      return;
    }
    setExamSubmitting(true);
    try {
      await addDoc(collection(db, 'exams'), {
        title: examForm.title.trim(),
        category: examForm.category,
        url: examForm.url.trim(),
        description: examForm.description.trim(),
        timestamp: serverTimestamp()
      });
      toast.success(`Exam/Assessment "${examForm.title}" posted successfully!`);
      setExamForm({ title: '', category: 'both', url: '', description: '' });
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error posting exam: ' + err.message);
    } finally {
      setExamSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async (id: string, collectionName: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success(`Deleted "${title}" successfully.`);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete item: ' + err.message);
    }
  };

  const fmtCategory = (cat: string) => {
    if (cat === 'school') return 'School Lectures';
    if (cat === 'private') return 'Private Lectures';
    if (cat === 'both') return 'All Students (Universal)';
    return cat || 'General';
  };

  const filteredResources = resources.filter(r => 
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLinks = links.filter(l => 
    l.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExams = exams.filter(e => 
    e.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
            <BookOpen className="text-brand-red w-8 h-8" />
            Learning Resources & Examinations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Publish, manage, and dispatch general study guides, Google Drive downloads, platform links, and programming assessments.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('resources')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'resources'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FolderOpen size={17} />
          <span>General Resources & Files ({resources.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'links'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <LinkIcon size={17} />
          <span>General Platform Links ({links.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'exams'
              ? 'border-brand-red text-brand-red'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <FileText size={17} />
          <span>Exams & Question Links ({exams.length})</span>
        </button>
      </div>

      {/* ══ TAB 1: RESOURCES ══ */}
      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload / Publish Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus size={18} className="text-brand-red" />
              Publish General Resource
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Upload your PDF/DOCX to Google Drive, Dropbox, or OneDrive. Set sharing to "Anyone with the link can view", then paste the link below.
            </p>

            <form onSubmit={handlePostResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={resForm.title}
                  onChange={(e) => setResForm({ ...resForm, title: e.target.value })}
                  placeholder="e.g. Python Full Stack Handbook"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Target Audience / Category
                </label>
                <select
                  value={resForm.category}
                  onChange={(e) => setResForm({ ...resForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="both">Both (School & Private Students)</option>
                  <option value="school">School Lectures Only</option>
                  <option value="private">Private / Individual Students Only</option>
                  <option value="coding">Coding & Software</option>
                  <option value="math">Mathematics</option>
                  <option value="science">Science & Robotics</option>
                  <option value="art">Design & Creative Art</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  File Download URL *
                </label>
                <input
                  type="url"
                  required
                  value={resForm.fileUrl}
                  onChange={(e) => setResForm({ ...resForm, fileUrl: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Description & Instructions
                </label>
                <textarea
                  rows={3}
                  value={resForm.description}
                  onChange={(e) => setResForm({ ...resForm, description: e.target.value })}
                  placeholder="Summary of contents, modules covered, and instructions for scholars..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={resSubmitting}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {resSubmitting ? 'Uploading...' : 'Publish Resource'}
              </button>
            </form>
          </div>

          {/* List of Published Resources */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Published Resources ({filteredResources.length})
              </h2>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading resources...</div>
            ) : filteredResources.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No resources found matching your search.
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
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-brand-red">
                          {fmtCategory(item.category)}
                        </span>
                        <button
                          onClick={() => handleDelete(item.id, 'resources', item.title)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete Resource"
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
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                      >
                        <ExternalLink size={14} /> Open File Link
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

      {/* ══ TAB 2: GENERAL LINKS ══ */}
      {activeTab === 'links' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Link Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus size={18} className="text-brand-red" />
              Deploy Platform Link
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Share interactive tool links (Scratch Studio, GitHub, Replit, Figma, or CodePen) directly into student portals.
            </p>

            <form onSubmit={handlePostLink} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Link Title *
                </label>
                <input
                  type="text"
                  required
                  value={linkForm.title}
                  onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                  placeholder="e.g. Scratch Game Engine Hub"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Category
                </label>
                <select
                  value={linkForm.category}
                  onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="both">Both (School & Private Students)</option>
                  <option value="school">School Lectures</option>
                  <option value="private">Private Lectures</option>
                  <option value="tutorial">Video Tutorials</option>
                  <option value="tools">Coding Tools & IDEs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  URL *
                </label>
                <input
                  type="url"
                  required
                  value={linkForm.url}
                  onChange={(e) => {
                    setLinkForm({ ...linkForm, url: e.target.value });
                    setPreviewLinkUrl(e.target.value);
                  }}
                  placeholder="https://scratch.mit.edu/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={linkForm.description}
                  onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                  placeholder="What is this link and how should scholars interact with it?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={linkSubmitting}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {linkSubmitting ? 'Posting...' : 'Deploy Link'}
              </button>
            </form>

            {previewLinkUrl && (
              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-gray-700 dark:text-gray-300 mb-2">Live Preview Test:</p>
                <iframe 
                  src={previewLinkUrl} 
                  title="Link Preview"
                  className="w-full h-36 border border-gray-200 dark:border-slate-700 rounded-lg bg-white"
                />
              </div>
            )}
          </div>

          {/* List of Published Links */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Platform Links ({filteredLinks.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading links...</div>
            ) : filteredLinks.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No links found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLinks.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                          {fmtCategory(item.category)}
                        </span>
                        <button
                          onClick={() => handleDelete(item.id, 'links', item.title)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete Link"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="font-black text-gray-900 dark:text-white text-base leading-snug mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 leading-relaxed">
                        {item.description || 'Direct platform access link.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink size={14} /> Open URL
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

      {/* ══ TAB 3: EXAMS ══ */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Exam Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus size={18} className="text-brand-red" />
              Deploy Question &amp; Exam
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Create an online test on Google Forms or Typeform, paste the public response link, and assign it to student cohorts.
            </p>

            <form onSubmit={handlePostExam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  placeholder="e.g. Mid-Term Python Logic Quiz"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Category
                </label>
                <select
                  value={examForm.category}
                  onChange={(e) => setExamForm({ ...examForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="both">Both (School & Private Students)</option>
                  <option value="school">School Lectures</option>
                  <option value="private">Private Lectures</option>
                  <option value="coding">Programming Assessment</option>
                  <option value="math">Mathematics Assessment</option>
                  <option value="science">Science & Robotics</option>
                </select>
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
                  Instructions & Timing
                </label>
                <textarea
                  rows={3}
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  placeholder="Exam duration, rules, submission deadlines, and grading notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={examSubmitting}
                className="w-full py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {examSubmitting ? 'Deploying...' : 'Deploy Exam Questions'}
              </button>
            </form>
          </div>

          {/* List of Published Exams */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Published Exams ({filteredExams.length})
            </h2>

            {loading ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading exams...</div>
            ) : filteredExams.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
                No exams found matching your search.
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
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                          {fmtCategory(item.category)}
                        </span>
                        <button
                          onClick={() => handleDelete(item.id, 'exams', item.title)}
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
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <ExternalLink size={14} /> Open Exam Paper
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

export default AdminResources;
