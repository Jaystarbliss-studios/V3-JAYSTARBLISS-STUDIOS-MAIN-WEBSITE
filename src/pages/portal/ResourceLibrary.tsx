import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookOpen, Search, Download, Bookmark, 
  Eye, CheckCircle2, Copy, Printer, 
  X, Terminal, Loader2, Zap, Users,
  Plus, Check, Sparkles, School, GraduationCap,
  FileText, ExternalLink, HelpCircle, Layers,
  ChevronRight, AlertCircle, Calendar
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, addDoc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import SEO from '../../components/ui/SEO';

export interface ResourceDocument {
  id: string;
  title: string;
  category: 'student' | 'school' | 'both' | 'staff' | 'all';
  subject: string;
  classLevel: string;
  docType: 'PDF' | 'Lesson Note' | 'Syllabus' | 'Practical Worksheet' | 'Cheatsheet' | 'Past Exam';
  description: string;
  fileUrl?: string;
  fileSize?: string;
  downloadCount?: number;
  term?: string;
  author?: string;
  assignedClasses?: string[];
  classInstructions?: string;
  schoolId?: string;
  schoolName?: string;
  isClassAssigned?: boolean;
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

interface ResourceLibraryProps {
  role?: 'student' | 'school' | 'staff' | 'parent' | 'all';
}

const STANDARD_SCHOOL_CLASSES = [
  'All Classes',
  'Creche & Early Years',
  'Nursery 1',
  'Nursery 2',
  'KG 1',
  'KG 2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'JSS 1',
  'JSS 2',
  'JSS 3',
  'SSS 1',
  'SSS 2',
  'SSS 3',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12'
];

const CLASS_LEVELS = [
  'All Classes',
  'Primary / Elementary (Grades 1-5)',
  'JSS 1-3 / Junior Secondary',
  'SSS 1-3 / Senior Secondary',
  'Foundational Science & Technology (Ages 10-13)',
  'Creative Coding (Ages 7-10)',
  'Foundational (Ages 6-8)',
  'Partner School Programmes (All Batches)'
];

const SUBJECTS = [
  'All Subjects',
  'Computer Science & ICT',
  'Python Programming',
  'Web Development (React & Tailwind)',
  'Hardware & Electronics',
  'Scratch & Visual Logic',
  'Digital Literacy & Safety',
  'UI/UX & Creative Design',
  'Data Structures & Algorithms'
];

const DOC_TYPES = [
  'All Types',
  'Syllabus',
  'Lesson Note',
  'Practical Worksheet',
  'Cheatsheet',
  'Past Exam',
  'PDF'
];

// Helper to check if student class matches assigned classes or classLevel
const checkClassMatch = (targetClass: string, assignedClasses?: string[], classLevel?: string): boolean => {
  if (!targetClass) return true;
  const tc = targetClass.trim().toLowerCase();
  
  if (assignedClasses && Array.isArray(assignedClasses) && assignedClasses.length > 0) {
    if (assignedClasses.some(c => c.toLowerCase() === 'all classes' || c.toLowerCase() === 'all' || c.toLowerCase() === 'general')) {
      return true;
    }
    return assignedClasses.some(c => {
      const cc = c.trim().toLowerCase();
      return cc === tc || cc.includes(tc) || tc.includes(cc);
    });
  }

  if (classLevel) {
    const cl = classLevel.trim().toLowerCase();
    if (cl === 'all classes' || cl === 'all') return true;
    return cl.includes(tc) || tc.includes(cl);
  }

  return true;
};

export const ResourceLibrary: React.FC<ResourceLibraryProps> = ({ role = 'all' }) => {
  const { toast } = useToast();
  const [resources, setResources] = useState<ResourceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedDocType, setSelectedDocType] = useState('All Types');
  const [activeTab, setActiveTab] = useState<'all' | 'myClass' | 'school' | 'recent' | 'saved' | 'syllabi' | 'notes' | 'worksheets'>('all');
  const [sortBy, setSortBy] = useState<'auto' | 'newest' | 'popular' | 'title-asc'>('auto');

  // Student Session Context
  const [studentInfo, setStudentInfo] = useState<{
    docId: string;
    studentClass: string;
    schoolId: string;
    schoolName: string;
  }>({
    docId: sessionStorage.getItem('studentDocId') || '',
    studentClass: sessionStorage.getItem('studentClass') || '',
    schoolId: sessionStorage.getItem('schoolId') || '',
    schoolName: sessionStorage.getItem('schoolName') || ''
  });

  // School Session Context
  const schoolId = sessionStorage.getItem('schoolId') || '';
  const schoolName = sessionStorage.getItem('schoolName') || 'Institutional Partner';

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

  // Class Assignment Modal State
  const [assignModalDoc, setAssignModalDoc] = useState<ResourceDocument | null>(null);
  const [assignSelectedClasses, setAssignSelectedClasses] = useState<string[]>([]);
  const [assignInstructions, setAssignInstructions] = useState('');
  const [customClassInput, setCustomClassInput] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // New Resource Upload Modal State (for school admins)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    subject: 'Computer Science & ICT',
    docType: 'Lesson Note' as ResourceDocument['docType'],
    classLevel: 'All Classes',
    assignedClasses: ['All Classes'],
    description: '',
    fileUrl: '',
    classInstructions: ''
  });
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  // Fetch Firestore resources dynamically
  const fetchFirestoreResources = useCallback(async () => {
    try {
      setLoading(true);
      const currentUid = auth.currentUser?.uid || '';
      const sDocId = sessionStorage.getItem('studentDocId') || '';
      const sClass = sessionStorage.getItem('studentClass') || '';
      const sSchoolId = sessionStorage.getItem('schoolId') || '';
      const sSchoolName = sessionStorage.getItem('schoolName') || '';

      setStudentInfo({
        docId: sDocId,
        studentClass: sClass,
        schoolId: sSchoolId,
        schoolName: sSchoolName
      });

      let dbItems: ResourceDocument[] = [];

      if (role === 'school') {
        const [resSnap, schoolResSnap] = await Promise.all([
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] }))
        ]);

        const rawList = [...resSnap.docs, ...schoolResSnap.docs];
        const seenIds = new Set<string>();

        dbItems = rawList.map(dDoc => {
          const d = dDoc.data();
          const docId = dDoc.id;
          seenIds.add(docId);
          return {
            id: docId,
            title: d.title || 'Curriculum Resource',
            category: (d.category as any) || 'school',
            subject: d.subject || d.subjectTrack || 'Computer Science & ICT',
            classLevel: d.classLevel || d.gradeLevel || 'All Classes',
            docType: (d.type as any) || (d.docType as any) || 'Lesson Note',
            description: d.description || 'Institutional lesson plan, worksheet or syllabus.',
            fileUrl: d.fileUrl || d.url || '',
            fileSize: d.fileSize || 'PDF Document',
            author: d.author || d.instructor || 'Jaystarbliss Tutors',
            assignedClasses: Array.isArray(d.assignedClasses) ? d.assignedClasses : (d.targetClass ? [d.targetClass] : (d.class ? [d.class] : [])),
            classInstructions: d.classInstructions || d.instructions || '',
            schoolId: d.schoolId || sSchoolId,
            schoolName: d.schoolName || sSchoolName,
            dateAdded: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : (d.assignedAt?.toDate ? d.assignedAt.toDate().toISOString() : (d.dateAdded || d.createdAt || '')),
            tags: d.tags || ['Curriculum Resource'],
            content: d.content
          };
        });
      } else if (role === 'staff') {
        const [resSnap, staffSnap, schoolResSnap] = await Promise.all([
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'staffGeneralResources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] }))
        ]);

        dbItems = [...resSnap.docs, ...staffSnap.docs, ...schoolResSnap.docs].map(dDoc => {
          const d = dDoc.data();
          return {
            id: dDoc.id,
            title: d.title || 'Teaching Resource',
            category: 'staff',
            subject: d.subject || d.subjectTrack || 'General',
            classLevel: d.classLevel || d.gradeLevel || 'All Classes',
            docType: (d.type as any) || (d.docType as any) || 'Lesson Note',
            description: d.description || 'Teaching material and curriculum resources.',
            fileUrl: d.fileUrl || d.url || '',
            fileSize: d.fileSize || 'Document',
            author: d.author || d.instructor || 'Jaystarbliss Studios',
            assignedClasses: Array.isArray(d.assignedClasses) ? d.assignedClasses : (d.targetClass ? [d.targetClass] : []),
            classInstructions: d.classInstructions || '',
            dateAdded: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : (d.dateAdded || d.createdAt || ''),
            tags: d.tags || ['Teaching Material'],
            content: d.content
          };
        });
      } else if (role === 'student') {
        // Students can access:
        // 1. All curriculum resources uploaded by Admin
        // 2. All school resources uploaded for their affiliated school (with class assignments)
        // 3. Personal resources assigned to this student
        const fetchPromises: Promise<any>[] = [
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] }))
        ];

        if (sSchoolId) {
          fetchPromises.push(
            getDocs(query(collection(db, 'schoolResources'), where('schoolId', '==', sSchoolId))).catch(() => 
              getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] }))
            )
          );
        } else {
          fetchPromises.push(getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] })));
        }

        let learnerIds = [sDocId, currentUid].filter(Boolean);
        if (learnerIds.length > 0) {
          learnerIds.forEach(id => {
            fetchPromises.push(
              getDocs(query(collection(db, 'personalResources'), where('studentId', '==', id))).catch(() => ({ docs: [] }))
            );
          });
        }

        const results = await Promise.all(fetchPromises);
        const allFetchedDocs: any[] = [];
        results.forEach(res => {
          if (res?.docs) allFetchedDocs.push(...res.docs);
        });

        const seenMap = new Map<string, ResourceDocument>();

        allFetchedDocs.forEach(dDoc => {
          const d = dDoc.data();
          const docId = dDoc.id;
          if (seenMap.has(docId)) return;

          const assignedClasses: string[] = Array.isArray(d.assignedClasses) 
            ? d.assignedClasses 
            : (d.targetClass ? [d.targetClass] : (d.class ? [d.class] : []));

          const isClassAssigned = sClass ? checkClassMatch(sClass, assignedClasses, d.classLevel || d.gradeLevel) : true;

          seenMap.set(docId, {
            id: docId,
            title: d.title || 'Learning Resource',
            category: (d.category as any) || (d.schoolId ? 'school' : 'student'),
            subject: d.subject || d.subjectTrack || 'Computer Science & ICT',
            classLevel: d.classLevel || d.gradeLevel || 'All Classes',
            docType: (d.type as any) || (d.docType as any) || 'Lesson Note',
            description: d.description || 'Lesson materials, practical exercises and guides.',
            fileUrl: d.fileUrl || d.url || '',
            fileSize: d.fileSize || 'PDF Document',
            author: d.author || d.instructor || 'Jaystarbliss Tutors',
            assignedClasses,
            classInstructions: d.classInstructions || d.instructions || '',
            schoolId: d.schoolId || '',
            schoolName: d.schoolName || '',
            isClassAssigned,
            dateAdded: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : (d.assignedAt?.toDate ? d.assignedAt.toDate().toISOString() : (d.dateAdded || d.createdAt || '')),
            tags: d.tags || ['Study Material'],
            content: d.content
          });
        });

        dbItems = Array.from(seenMap.values());
      } else {
        // Parent or general visitor
        let learnerIds = [sDocId, currentUid].filter(Boolean);
        if (role === 'parent' && currentUid) {
          try {
            const childSnap = await getDocs(query(collection(db, 'individualStudents'), where('parentId', '==', currentUid)));
            learnerIds = [...new Set([...learnerIds, ...childSnap.docs.map(d => d.id)])];
          } catch {}
        }

        const [resSnap, schoolResSnap, ...personalDocs] = await Promise.all([
          getDocs(collection(db, 'resources')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'schoolResources')).catch(() => ({ docs: [] })),
          ...learnerIds.map(id => getDocs(query(collection(db, 'personalResources'), where('studentId', '==', id))).catch(() => ({ docs: [] })))
        ]);

        const combined = [...resSnap.docs, ...schoolResSnap.docs, ...personalDocs.flatMap((p: any) => p.docs || [])];
        const seenMap = new Map<string, ResourceDocument>();

        combined.forEach(dDoc => {
          const d = dDoc.data();
          if (seenMap.has(dDoc.id)) return;
          seenMap.set(dDoc.id, {
            id: dDoc.id,
            title: d.title || 'Curriculum Resource',
            category: (d.category as any) || 'student',
            subject: d.subject || d.subjectTrack || 'Computer Science & ICT',
            classLevel: d.classLevel || d.gradeLevel || 'All Classes',
            docType: (d.type as any) || (d.docType as any) || 'Lesson Note',
            description: d.description || 'Reference notes, syllabus, or worksheet.',
            fileUrl: d.fileUrl || d.url || '',
            fileSize: d.fileSize || 'PDF Document',
            author: d.author || d.instructor || 'Jaystarbliss Tutors',
            assignedClasses: Array.isArray(d.assignedClasses) ? d.assignedClasses : [],
            classInstructions: d.classInstructions || '',
            schoolId: d.schoolId || '',
            schoolName: d.schoolName || '',
            dateAdded: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : (d.dateAdded || d.createdAt || ''),
            tags: d.tags || ['Study Material'],
            content: d.content
          });
        });

        dbItems = Array.from(seenMap.values());
      }

      setResources(dbItems);
    } catch (err) {
      console.warn('Could not fetch resources:', err);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchFirestoreResources();
  }, [fetchFirestoreResources]);

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

  // Open Class Assignment Modal for a resource
  const handleOpenAssignModal = (docItem: ResourceDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAssignModalDoc(docItem);
    setAssignSelectedClasses(docItem.assignedClasses && docItem.assignedClasses.length > 0 ? [...docItem.assignedClasses] : ['All Classes']);
    setAssignInstructions(docItem.classInstructions || '');
    setCustomClassInput('');
  };

  // Toggle class selection inside modal
  const toggleClassSelection = (cls: string) => {
    if (cls === 'All Classes') {
      if (assignSelectedClasses.includes('All Classes')) {
        setAssignSelectedClasses([]);
      } else {
        setAssignSelectedClasses(['All Classes']);
      }
      return;
    }

    setAssignSelectedClasses(prev => {
      const withoutAll = prev.filter(c => c !== 'All Classes');
      if (withoutAll.includes(cls)) {
        const next = withoutAll.filter(c => c !== cls);
        return next.length === 0 ? ['All Classes'] : next;
      } else {
        return [...withoutAll, cls];
      }
    });
  };

  // Add custom class label
  const handleAddCustomClass = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customClassInput.trim();
    if (!val) return;
    if (!assignSelectedClasses.includes(val)) {
      setAssignSelectedClasses(prev => [...prev.filter(c => c !== 'All Classes'), val]);
    }
    setCustomClassInput('');
  };

  // Save Class Assignment to Firestore
  const handleSaveClassAssignment = async () => {
    if (!assignModalDoc) return;
    if (assignSelectedClasses.length === 0) {
      toast.error('Please select at least one target class or choose "All Classes".');
      return;
    }

    setSavingAssignment(true);
    try {
      const activeSchoolId = schoolId || studentInfo.schoolId || 'default_school';
      const activeSchoolName = schoolName || studentInfo.schoolName || 'School Institution';

      // 1. Update in schoolResources collection
      const schoolResRef = doc(db, 'schoolResources', assignModalDoc.id);
      
      const payload = {
        title: assignModalDoc.title,
        description: assignModalDoc.description,
        fileUrl: assignModalDoc.fileUrl || '',
        subject: assignModalDoc.subject,
        docType: assignModalDoc.docType,
        category: 'school',
        schoolId: activeSchoolId,
        schoolName: activeSchoolName,
        assignedClasses: assignSelectedClasses,
        classInstructions: assignInstructions.trim(),
        assignedAt: serverTimestamp(),
        assignedBy: auth.currentUser?.email || 'School Administrator'
      };

      await setDoc(schoolResRef, payload, { merge: true });

      // Optimistically update local state
      setResources(prev => prev.map(item => {
        if (item.id === assignModalDoc.id) {
          return {
            ...item,
            assignedClasses: assignSelectedClasses,
            classInstructions: assignInstructions.trim(),
            schoolId: activeSchoolId,
            schoolName: activeSchoolName
          };
        }
        return item;
      }));

      toast.success(`Lesson "${assignModalDoc.title}" successfully assigned to ${assignSelectedClasses.join(', ')}!`);
      setAssignModalDoc(null);
    } catch (err: any) {
      console.error('Error assigning classes:', err);
      toast.error('Failed to update class assignment: ' + (err?.message || 'Permission denied'));
    } finally {
      setSavingAssignment(false);
    }
  };

  // Upload New School Resource
  const handleCreateSchoolResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !uploadForm.fileUrl.trim()) {
      toast.error('Please enter a lesson title and document/file URL.');
      return;
    }

    setUploadSubmitting(true);
    try {
      const activeSchoolId = schoolId || studentInfo.schoolId || 'default_school';
      const activeSchoolName = schoolName || studentInfo.schoolName || 'School Institution';

      const newDoc = {
        title: uploadForm.title.trim(),
        subject: uploadForm.subject,
        docType: uploadForm.docType,
        classLevel: uploadForm.classLevel,
        assignedClasses: uploadForm.assignedClasses,
        description: uploadForm.description.trim() || 'School curriculum lesson material.',
        fileUrl: uploadForm.fileUrl.trim(),
        classInstructions: uploadForm.classInstructions.trim(),
        category: 'school',
        schoolId: activeSchoolId,
        schoolName: activeSchoolName,
        assignedAt: serverTimestamp(),
        assignedBy: auth.currentUser?.email || 'School Administrator'
      };

      await addDoc(collection(db, 'schoolResources'), newDoc);

      toast.success(`Lesson "${uploadForm.title}" uploaded & assigned successfully!`);
      setIsUploadModalOpen(false);
      setUploadForm({
        title: '',
        subject: 'Computer Science & ICT',
        docType: 'Lesson Note',
        classLevel: 'All Classes',
        assignedClasses: ['All Classes'],
        description: '',
        fileUrl: '',
        classInstructions: ''
      });

      // Refetch
      fetchFirestoreResources();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload lesson: ' + (err?.message || 'Error occurred'));
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Filtered resources list
  const filteredResources = useMemo(() => {
    const list = resources.filter(item => {
      // Tab filter
      if (activeTab === 'recent') {
        if (!isResourceRecent(item.dateAdded)) return false;
      } else if (activeTab === 'saved') {
        if (!bookmarkedIds.includes(item.id)) return false;
      } else if (activeTab === 'myClass') {
        if (studentInfo.studentClass) {
          if (!checkClassMatch(studentInfo.studentClass, item.assignedClasses, item.classLevel)) return false;
        }
      } else if (activeTab === 'school') {
        if (!item.schoolId && item.category !== 'school') return false;
      } else if (activeTab === 'syllabi') {
        if (item.docType !== 'Syllabus') return false;
      } else if (activeTab === 'notes') {
        if (item.docType !== 'Lesson Note') return false;
      } else if (activeTab === 'worksheets') {
        if (item.docType !== 'Practical Worksheet' && item.docType !== 'Cheatsheet' && item.docType !== 'Past Exam') return false;
      }

      // Class dropdown filter
      if (selectedClass !== 'All Classes') {
        const matchesClass = checkClassMatch(selectedClass, item.assignedClasses, item.classLevel);
        if (!matchesClass) return false;
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
        const classMatch = item.assignedClasses?.some(c => c.toLowerCase().includes(q)) || item.classLevel.toLowerCase().includes(q);
        const tagMatch = item.tags?.some(t => t.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !subjectMatch && !classMatch && !tagMatch) return false;
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
  }, [resources, activeTab, studentInfo.studentClass, selectedClass, selectedSubject, selectedDocType, searchQuery, bookmarkedIds, sortBy]);

  // Compute stats
  const recentCount = useMemo(() => resources.filter(item => isResourceRecent(item.dateAdded)).length, [resources]);
  const myClassCount = useMemo(() => {
    if (!studentInfo.studentClass) return 0;
    return resources.filter(item => checkClassMatch(studentInfo.studentClass, item.assignedClasses, item.classLevel)).length;
  }, [resources, studentInfo.studentClass]);

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
      case 'Practical Worksheet':
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
              Curriculum &amp; Learning Library
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-2 leading-relaxed">
              Official course syllabi, step-by-step lecture notes, coding worksheets, practical guides, and institutional class assignments.
            </p>
            {role === 'student' && studentInfo.studentClass && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-xs font-bold text-emerald-300 border border-emerald-500/30">
                <GraduationCap size={15} />
                <span>Class: {studentInfo.studentClass}</span>
                {studentInfo.schoolName && <span className="text-gray-300">• {studentInfo.schoolName}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
              <div className="text-2xl font-black text-brand-red font-mono">{resources.length}</div>
              <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Total Resources</div>
            </div>

            {(role === 'school' || role === 'all') && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-3 bg-brand-red hover:bg-red-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-red/20 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>New Lesson Plan</span>
              </button>
            )}
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
              placeholder="Search by topic, keyword, Python, Scratch, Hardware & Electronics, JSS, HTML..."
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

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-brand-red text-white shadow-xs' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              All Resources ({resources.length})
            </button>

            {role === 'student' && studentInfo.studentClass && (
              <button
                onClick={() => setActiveTab('myClass')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'myClass' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/60 dark:border-emerald-800/60'
                }`}
              >
                <GraduationCap size={13} />
                <span>My Class Lessons ({myClassCount})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'recent' 
                  ? 'bg-amber-500 text-white shadow-xs' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <Zap size={13} />
              <span>48h Recent ({recentCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'saved' 
                  ? 'bg-brand-slate text-white shadow-xs' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Class / Grade Target</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden focus:border-brand-red"
            >
              {STANDARD_SCHOOL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Subject Track</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden focus:border-brand-red"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Doc Format</label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden focus:border-brand-red"
            >
              {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 outline-hidden focus:border-brand-red"
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
          <p className="text-xs text-gray-500 font-medium">Syncing curriculum and school class assignments from Firestore...</p>
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
              ? 'Curriculum syllabi, lesson notes, and practical worksheets uploaded by educators in the Admin Panel will appear here automatically.'
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
              className="mt-4 px-4 py-2 bg-brand-slate hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
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
            const isAssignedToStudent = role === 'student' && studentInfo.studentClass && checkClassMatch(studentInfo.studentClass, item.assignedClasses, item.classLevel);

            return (
              <div
                key={item.id}
                onClick={() => setPreviewDoc(item)}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-brand-red/40 transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getDocTypeBadge(item.docType)}`}>
                        {item.docType}
                      </span>

                      {item.schoolId && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-bold border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                          <School size={10} />
                          <span>School Resource</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRecent && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center gap-1 shadow-2xs">
                          <Zap size={10} /> 48h
                        </span>
                      )}
                      <button
                        onClick={(e) => toggleBookmark(item.id, e)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isBookmarked ? 'text-brand-red bg-red-50 dark:bg-red-950/40' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                        title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Resource'}
                      >
                        <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-black text-sm text-gray-900 dark:text-white group-hover:text-brand-red transition-colors line-clamp-2 mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3">
                    {item.description}
                  </p>

                  {/* Class Assignment Badge for Students & Admins */}
                  <div className="mb-3 space-y-1.5">
                    {isAssignedToStudent && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/60">
                        <GraduationCap size={13} className="text-emerald-600 shrink-0" />
                        <span>Assigned to your Class ({studentInfo.studentClass})</span>
                      </div>
                    )}

                    {item.assignedClasses && item.assignedClasses.length > 0 && !isAssignedToStudent && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                        <Users size={12} className="text-brand-red shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          Classes: {item.assignedClasses.join(', ')}
                        </span>
                      </div>
                    )}

                    {item.classInstructions && (
                      <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 line-clamp-2">
                        <span className="font-bold">Instructions: </span>
                        <span>{item.classInstructions}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer & Action Buttons */}
                <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-gray-500 gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[130px]">
                    {item.subject}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* School Administrator "Assign to Class" Action */}
                    {(role === 'school' || role === 'staff' || role === 'all') && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenAssignModal(item, e)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-red hover:text-white dark:hover:bg-brand-red text-slate-700 dark:text-slate-300 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Assign to specific classes"
                      >
                        <Users size={12} />
                        <span>Assign</span>
                      </button>
                    )}

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
                        className="p-1.5 rounded-lg text-gray-500 hover:text-brand-red hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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

      {/* ══ ASSIGN RESOURCE TO CLASS MODAL (FOR SCHOOL ADMINISTRATORS) ══ */}
      {assignModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-red/10 text-brand-red text-[10px] font-black uppercase tracking-wider mb-2">
                  <Users size={12} />
                  <span>Institutional Class Delivery</span>
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Assign Lesson Plan to Classes
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-md">
                  {assignModalDoc.title}
                </p>
              </div>

              <button
                onClick={() => setAssignModalDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs">
              
              {/* Resource Meta Box */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Subject Track</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{assignModalDoc.subject}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Doc Type</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{assignModalDoc.docType}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Default Grade</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{assignModalDoc.classLevel}</div>
                </div>
              </div>

              {/* Class Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <GraduationCap size={15} className="text-brand-red" />
                    <span>Select Target Class(es)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignSelectedClasses(['All Classes'])}
                      className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      All Classes
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignSelectedClasses([])}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Students registered under the selected classes will see this lesson plan in their portal dashboard.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {STANDARD_SCHOOL_CLASSES.map(cls => {
                    const isSelected = assignSelectedClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClassSelection(cls)}
                        className={`p-2 rounded-xl text-left font-semibold text-xs transition-all flex items-center justify-between border cursor-pointer ${
                          isSelected 
                            ? 'bg-brand-red text-white border-brand-red shadow-2xs' 
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{cls}</span>
                        {isSelected && <Check size={14} className="shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Class Name Adder */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Add Custom Class Label (e.g. Basic 4 Diamond, Year 8 Alpha)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customClassInput}
                    onChange={(e) => setCustomClassInput(e.target.value)}
                    placeholder="Enter custom class name..."
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomClass}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Add Class
                  </button>
                </div>
              </div>

              {/* Currently Selected Summary */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1.5">
                  Selected Classes ({assignSelectedClasses.length}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assignSelectedClasses.map(c => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-brand-red border border-red-200 dark:border-red-900/60 font-bold text-xs"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => toggleClassSelection(c)}
                        className="hover:text-red-800 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Class Instructions / Homework Note */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                  Class Instructions &amp; Homework Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="e.g., Read Sections 1 & 2 and complete the Scratch coding assignment before Thursday's practical lab."
                  className="w-full p-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-hidden focus:border-brand-red resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignModalDoc(null)}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingAssignment}
                onClick={handleSaveClassAssignment}
                className="px-5 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-red/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingAssignment ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Saving Assignment...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Confirm &amp; Assign to Classes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ UPLOAD NEW SCHOOL RESOURCE MODAL ══ */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Publish Institutional Lesson Plan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload learning materials and assign them directly to your school classes.
                </p>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSchoolResource} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Lesson Title *</label>
                <input
                  required
                  type="text"
                  value={uploadForm.title}
                  onChange={e => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Introduction to Python Loops & Data Types"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject Track</label>
                  <select
                    value={uploadForm.subject}
                    onChange={e => setUploadForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red"
                  >
                    {SUBJECTS.filter(s => s !== 'All Subjects').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Doc Type</label>
                  <select
                    value={uploadForm.docType}
                    onChange={e => setUploadForm(prev => ({ ...prev, docType: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red"
                  >
                    {DOC_TYPES.filter(d => d !== 'All Types').map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Document / Resource File Link *</label>
                <input
                  required
                  type="url"
                  value={uploadForm.fileUrl}
                  onChange={e => setUploadForm(prev => ({ ...prev, fileUrl: e.target.value }))}
                  placeholder="https://drive.google.com/... or https://..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assign to Class</label>
                <select
                  value={uploadForm.assignedClasses[0] || 'All Classes'}
                  onChange={e => setUploadForm(prev => ({ ...prev, assignedClasses: [e.target.value] }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red"
                >
                  {STANDARD_SCHOOL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description / Summary</label>
                <textarea
                  rows={2}
                  value={uploadForm.description}
                  onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief summary of topics covered..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Class Instructions (Optional)</label>
                <textarea
                  rows={2}
                  value={uploadForm.classInstructions}
                  onChange={e => setUploadForm(prev => ({ ...prev, classInstructions: e.target.value }))}
                  placeholder="Notes or prep instructions for students..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white outline-hidden focus:border-brand-red resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploadSubmitting}
                  className="w-full py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-brand-red/20 cursor-pointer disabled:opacity-50"
                >
                  {uploadSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Publish &amp; Assign Resource</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ INTERACTIVE DOCUMENT READER MODAL ══ */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getDocTypeBadge(previewDoc.docType)}`}>
                    {previewDoc.docType}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">
                    {previewDoc.classLevel}
                  </span>
                  {previewDoc.assignedClasses && previewDoc.assignedClasses.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/60">
                      Assigned: {previewDoc.assignedClasses.join(', ')}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  {previewDoc.title}
                </h2>
              </div>

              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm custom-scrollbar">
              {previewDoc.classInstructions && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <Sparkles size={14} /> Class Instructions from School
                  </div>
                  <p className="text-xs leading-relaxed">{previewDoc.classInstructions}</p>
                </div>
              )}

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
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
