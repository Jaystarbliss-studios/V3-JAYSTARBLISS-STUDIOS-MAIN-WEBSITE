import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, Download, Bookmark, 
  Eye, CheckCircle2, Copy, Printer, 
  X, Terminal, Loader2, Zap
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

export interface ResourceDocument {
  id: string;
  title: string;
  category: 'student' | 'school' | 'both' | 'staff' | 'all';
  subject: string;
  classLevel: string;
  docType: 'PDF' | 'Lesson Note' | 'Syllabus' | 'Lab Worksheet' | 'Cheatsheet' | 'Past Exam';
  description: string;
  fileUrl?: string;
  fileSize?: string;
  downloadCount?: number;
  term?: string;
  author?: string;
  content?: {
    overview: string;
    learningObjectives: string[];
    keyConcepts: { heading: string; detail: string; codeSnippet?: string }[];
    practiceExercises: string[];
    furtherReading?: string;
  };
  tags?: string[];
  dateAdded?: string;
  isFeatured?: boolean;
}

// Recency Helper Function
const isResourceRecent = (dateAdded?: string): boolean => {
  if (!dateAdded) return false;
  try {
    const time = new Date(dateAdded).getTime();
    if (isNaN(time)) return false;
    const diffMs = Date.now() - time;
    return diffMs >= -300000 && diffMs <= 48 * 3600 * 1000;
  } catch {
    return false;
  }
};

export const CURATED_RESOURCE_LIBRARY: ResourceDocument[] = [];

interface ResourceLibraryProps {
  role?: 'student' | 'school' | 'staff' | 'parent' | 'all';
}

const CLASS_LEVELS = [
  'All Classes',
  'Primary / Elementary (Grades 1-5)',
  'JSS 1-3 / Junior Secondary',
  'SSS 1-3 / Senior Secondary',
  'STEM Explorers (Ages 10-13)',
  'Creative Coders (Ages 7-10)',
  'Foundational (Ages 6-8)',
  'Partner School Labs (All Batches)'
];

const SUBJECTS = [
  'All Subjects',
  'Computer Science & ICT',
  'Python Programming',
  'Web Development (React & Tailwind)',
  'Robotics & Arduino IoT',
  'Scratch & Visual Logic',
  'Digital Literacy & Safety',
  'UI/UX & Creative Design',
  'Data Structures & Algorithms'
];

const DOC_TYPES = [
  'All Types',
  'Syllabus',
  'Lesson Note',
  'Lab Worksheet',
  'Cheatsheet',
  'Past Exam',
  'PDF'
];

export const ResourceLibrary: React.FC<ResourceLibraryProps> = ({ role = 'all' }) => {
  const { toast } = useToast();
  const [resources, setResources] = useState<ResourceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedDocType, setSelectedDocType] = useState('All Types');
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'saved' | 'syllabi' | 'notes' | 'worksheets'>('all');
  const [sortBy, setSortBy] = useState<'auto' | 'newest' | 'popular' | 'title-asc'>('auto');

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jaystarbliss_bookmarked_resources');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active Document Reader Modal
  const [previewDoc, setPreviewDoc] = useState<ResourceDocument | null>(null);

  // Compute number of items uploaded in the last 48 hours for current role
  const recentCount = useMemo(() => {
    return resources.filter(item => {
      if (role === 'student' && item.category === 'school') return false;
      if (role === 'school' && item.category === 'student') return false;
      return isResourceRecent(item.dateAdded);
    }).length;
  }, [resources, role]);

  // Fetch Firestore resources dynamically
  useEffect(() => {
    const fetchFirestoreResources = async () => {
      try {
        setLoading(true);
        const [resSnap, schoolResSnap] = await Promise.all([
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] }))
        ]);
        
        const allDocs = [...resSnap.docs, ...schoolResSnap.docs];
        const dbItems: ResourceDocument[] = allDocs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            title: d.title || 'Curriculum Resource',
            category: d.category || (d.targetRole === 'school' ? 'school' : 'both'),
            subject: d.subject || d.subjectTrack || 'Computer Science & ICT',
            classLevel: d.classLevel || d.gradeLevel || 'STEM Explorers (Ages 10-13)',
            docType: (d.type as any) || (d.docType as any) || 'PDF',
            description: d.description || 'Reference notes, syllabus, or worksheet.',
            fileUrl: d.fileUrl || d.url || '',
            fileSize: d.fileSize || 'PDF Document',
            author: d.author || d.instructor || 'Jaystarbliss Tutors',
            dateAdded: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.dateAdded || d.createdAt || '',
            tags: d.tags || ['Study Material'],
            content: d.content
          };
        });

        setResources(dbItems);
      } catch (err) {
        console.warn('Could not fetch external resources:', err);
        setResources([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFirestoreResources();
  }, []);

  // Handle bookmark toggle
  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarkedIds(prev => {
      const updated = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      try {
        localStorage.setItem('jaystarbliss_bookmarked_resources', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save bookmark locally', err);
      }
      return updated;
    });
  };

  // Filtered resources list
  const filteredResources = useMemo(() => {
    const list = resources.filter(item => {
      // Role match
      if (role === 'student' && item.category === 'school') return false;
      if (role === 'school' && item.category === 'student') return false;

      // Active tab filter
      if (activeTab === 'recent') {
        if (!isResourceRecent(item.dateAdded)) return false;
      } else if (activeTab === 'saved') {
        if (!bookmarkedIds.includes(item.id)) return false;
      } else if (activeTab === 'syllabi') {
        if (item.docType !== 'Syllabus') return false;
      } else if (activeTab === 'notes') {
        if (item.docType !== 'Lesson Note') return false;
      } else if (activeTab === 'worksheets') {
        if (item.docType !== 'Lab Worksheet' && item.docType !== 'Cheatsheet' && item.docType !== 'Past Exam') return false;
      }

      // Class Filter
      if (selectedClass !== 'All Classes' && !item.classLevel.toLowerCase().includes(selectedClass.toLowerCase().slice(0, 8))) {
        return false;
      }

      // Subject Filter
      if (selectedSubject !== 'All Subjects' && item.subject !== selectedSubject) {
        return false;
      }

      // Doc Type Filter
      if (selectedDocType !== 'All Types' && item.docType !== selectedDocType) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(q);
        const descMatch = item.description.toLowerCase().includes(q);
        const subjectMatch = item.subject.toLowerCase().includes(q);
        const tagMatch = item.tags?.some(t => t.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !subjectMatch && !tagMatch) return false;
      }

      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'auto') {
        const aRecent = isResourceRecent(a.dateAdded);
        const bRecent = isResourceRecent(b.dateAdded);
        if (aRecent && !bRecent) return -1;
        if (!aRecent && bRecent) return 1;
        const timeA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const timeB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === 'newest') {
        const timeA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const timeB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === 'popular') {
        const popA = (a.isFeatured ? 50 : 10) + (bookmarkedIds.includes(a.id) ? 25 : 0);
        const popB = (b.isFeatured ? 50 : 10) + (bookmarkedIds.includes(b.id) ? 25 : 0);
        return popB - popA;
      } else if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [resources, role, activeTab, selectedClass, selectedSubject, selectedDocType, searchQuery, bookmarkedIds, sortBy]);

  const copyDocLink = (docItem: ResourceDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/portal/${role}/resources?doc=${docItem.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Resource link copied to clipboard!');
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'Syllabus':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Lesson Note':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Lab Worksheet':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Cheatsheet':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Past Exam':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SEO 
        title="Resource Library & Syllabi Hub | Jaystarbliss Studios" 
        description="Search, view and download lesson notes, curriculum syllabi, and coding worksheets for students and school educators."
        noindex={true}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-slate via-slate-900 to-brand-slate text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-red/20 text-brand-red text-xs font-bold uppercase tracking-wider mb-3 border border-brand-red/30">
              <BookOpen size={13} />
              <span>Academic Resource Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              Curriculum & Learning Library
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-2 leading-relaxed">
              Official course syllabi, step-by-step lecture notes, coding worksheets, and revision past questions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
              <div className="text-2xl font-black text-brand-red">{resources.length}</div>
              <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Total Resources</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by topic, keyword, Python, Scratch, Robotics, JSS, HTML..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-hidden focus:border-brand-red"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                activeTab === 'all' 
                  ? 'bg-brand-red text-white shadow-xs' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              All Resources
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'recent' 
                  ? 'bg-amber-500 text-white shadow-xs' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Zap size={13} />
              <span>48h Recent ({recentCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'saved' 
                  ? 'bg-brand-slate text-white shadow-xs' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <Bookmark size={13} />
              <span>Bookmarked ({bookmarkedIds.length})</span>
            </button>
          </div>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Class / Grade</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden"
            >
              {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Subject Track</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Doc Format</label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden"
            >
              {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden"
            >
              <option value="auto">⚡ Auto (Recent 48h First)</option>
              <option value="newest">🕒 Newest Uploads</option>
              <option value="popular">🔥 Most Popular / Saved</option>
              <option value="title-asc">🔤 Title (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Results Container */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="animate-spin text-brand-red mb-3" size={32} />
          <p className="text-xs text-gray-500 font-medium">Syncing curriculum resources from Firestore...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800 p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-slate-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={24} />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            {resources.length === 0 ? 'No curriculum resources uploaded yet' : 'No matching resources found'}
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
            {resources.length === 0 
              ? 'Curriculum syllabi, lesson notes, and lab worksheets uploaded by educators in the Admin Panel will appear here automatically.'
              : 'Try resetting your search query, class grade, or document format filters.'}
          </p>
          {resources.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedClass('All Classes');
                setSelectedSubject('All Subjects');
                setSelectedDocType('All Types');
                setActiveTab('all');
              }}
              className="mt-4 px-4 py-2 bg-brand-slate hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(item => {
            const isBookmarked = bookmarkedIds.includes(item.id);
            const isRecent = isResourceRecent(item.dateAdded);

            return (
              <div
                key={item.id}
                onClick={() => setPreviewDoc(item)}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-brand-red/40 transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getDocTypeBadge(item.docType)}`}>
                      {item.docType}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isRecent && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center gap-1">
                          <Zap size={10} /> 48h
                        </span>
                      )}
                      <button
                        onClick={(e) => toggleBookmark(item.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isBookmarked ? 'text-brand-red bg-red-50 dark:bg-red-950/40' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                        title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Resource'}
                      >
                        <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-black text-sm text-gray-900 dark:text-white group-hover:text-brand-red transition-colors line-clamp-2 mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                    {item.subject}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.fileUrl ? (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-brand-red hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="Download Document"
                      >
                        <Download size={14} />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => copyDocLink(item, e)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-brand-red hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy Link"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                    <span className="font-bold text-brand-red flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Read <Eye size={12} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Document Reader Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getDocTypeBadge(previewDoc.docType)}`}>
                    {previewDoc.docType}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    {previewDoc.classLevel}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  {previewDoc.title}
                </h2>
              </div>

              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Overview</h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {previewDoc.content?.overview || previewDoc.description}
                </p>
              </div>

              {previewDoc.content?.learningObjectives && previewDoc.content.learningObjectives.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Key Objectives</h4>
                  <ul className="space-y-2">
                    {previewDoc.content.learningObjectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewDoc.content?.keyConcepts && previewDoc.content.keyConcepts.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Core Curriculum Modules</h4>
                  {previewDoc.content.keyConcepts.map((concept, i) => (
                    <div key={i} className="p-4 bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 space-y-2">
                      <h5 className="font-bold text-gray-900 dark:text-white">{concept.heading}</h5>
                      <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">{concept.detail}</p>
                      {concept.codeSnippet && (
                        <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                          {concept.codeSnippet}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {previewDoc.content?.practiceExercises && previewDoc.content.practiceExercises.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Hands-on Exercises</h4>
                  <div className="space-y-2">
                    {previewDoc.content.practiceExercises.map((ex, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 border border-blue-100 dark:border-blue-900/40">
                        <Terminal size={15} className="text-blue-600 shrink-0 mt-0.5" />
                        <span className="text-xs">{ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Subject: <strong className="text-gray-700 dark:text-gray-300">{previewDoc.subject}</strong></span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer size={14} /> Print Document
                </button>
                {previewDoc.fileUrl && (
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Download File
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceLibrary;
