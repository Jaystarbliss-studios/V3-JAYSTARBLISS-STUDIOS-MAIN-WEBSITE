import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, User, BookOpen, Calendar, 
  CreditCard, Clock, Link as LinkIcon, ShieldCheck, 
  Sparkles, Loader2, Copy, Check, Mail, Phone,
  Layers, AlertCircle, Award, CheckSquare, Square
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, doc, getDocs, setDoc, updateDoc, 
  addDoc, serverTimestamp, query, where, limit 
} from 'firebase/firestore';
import { useToast } from '../../contexts/ToastContext';
import { resolveRealName, formatTutorDropdownLabel } from '../../utils/userNames';

export interface EnrollmentRequestData {
  id: string;
  studentName?: string;
  name?: string;
  studentAge?: string;
  studentClass?: string;
  class?: string;
  grade?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentId?: string;
  plan?: string;
  subjects?: string[] | string;
  notes?: string;
  email?: string;
  phone?: string;
  source?: string;
  createdAt?: any;
}

interface ProgramOption {
  id: string;
  title: string;
  name?: string;
  price?: number;
  fee?: number;
  tuition?: number;
  category?: string;
  level?: string;
  duration?: string;
  seriesName?: string;
  hasStages?: boolean;
  stageNumber?: number;
  stageName?: string;
  isSeries?: boolean;
}

interface TutorOption {
  id: string;
  name: string;
  email: string;
  phone?: string;
  qualification?: string;
  subjects?: string[] | string;
}

interface Props {
  request: EnrollmentRequestData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (studentData: any) => void;
}

const DAYS_OF_WEEK = [
  { id: 'Monday', label: 'Mon', short: 'M', dayIndex: 1 },
  { id: 'Tuesday', label: 'Tue', short: 'T', dayIndex: 2 },
  { id: 'Wednesday', label: 'Wed', short: 'W', dayIndex: 3 },
  { id: 'Thursday', label: 'Thu', short: 'Th', dayIndex: 4 },
  { id: 'Friday', label: 'Fri', short: 'F', dayIndex: 5 },
  { id: 'Saturday', label: 'Sat', short: 'Sa', dayIndex: 6 },
  { id: 'Sunday', label: 'Sun', short: 'Su', dayIndex: 0 },
];

export const StudentEnrollmentApprovalModal: React.FC<Props> = ({
  request,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Available data lists
  const [programsList, setProgramsList] = useState<ProgramOption[]>([]);
  const [tutorsList, setTutorsList] = useState<TutorOption[]>([]);

  // Step 1: Program Configuration
  const [programMode, setProgramMode] = useState<'single' | 'series' | 'custom'>('single');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedSeriesProgramIds, setSelectedSeriesProgramIds] = useState<string[]>([]);
  const [customProgramTitle, setCustomProgramTitle] = useState('');

  // Step 2: Tuition Fee & Payment Terms
  const [tuitionFee, setTuitionFee] = useState<number>(35000);
  const [feePlanType, setFeePlanType] = useState('Full Session Tuition');
  const [paymentTermsNote, setPaymentTermsNote] = useState('Standard academy tuition fee');

  // Step 3: Tutor / Mentor Assignment
  const [selectedTutorId, setSelectedTutorId] = useState('');
  const [customTutorName, setCustomTutorName] = useState('');
  const [customTutorEmail, setCustomTutorEmail] = useState('');
  const [tutorRole, setTutorRole] = useState('Lead Mentor');

  // Step 4: Class Schedule
  const [deliveryMode, setDeliveryMode] = useState<'online' | 'physical' | 'hybrid'>('online');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Saturday']);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [meetingLink, setMeetingLink] = useState('https://meet.google.com/jds-live-class');
  const [locationRoom, setLocationRoom] = useState('Main Technology Innovation Lab');
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(8);

  // Step 5: Student Credentials Preview
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [generatedAccessCode, setGeneratedAccessCode] = useState('');
  const [sendParentNotification, setSendParentNotification] = useState(true);
  const [sendParentEmail, setSendParentEmail] = useState(true);

  // Success state view
  const [approvedResult, setApprovedResult] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Generate clean random access code
  const makeAccessCode = (length = 7) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => chars[b % chars.length]).join('');
  };

  // Generate unique clean username
  const makeUsername = (studentName: string, reqId: string) => {
    const cleanName = (studentName || 'cadet')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toLowerCase()
      .slice(0, 14);
    const suffix = (reqId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase() || Math.floor(100 + Math.random() * 900).toString();
    return `${cleanName || 'student'}_${suffix}`;
  };

  // Fetch programs and tutors when modal opens
  useEffect(() => {
    if (!isOpen || !request) return;

    let isMounted = true;
    setLoadingInitial(true);
    setApprovedResult(null);

    const loadOptions = async () => {
      try {
        const [
          programsSnap, 
          tutorsSnap, 
          usersSnap, 
          staffSnap, 
          appsSnap,
          inquiriesSnap,
          tutorSubjectsSnap
        ] = await Promise.all([
          getDocs(collection(db, 'programs')).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, 'tutors')).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, 'users')).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, 'staff')).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, 'tutor_applications')).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, 'inquiries')).catch(() => ({ docs: [] } as any)),
          getDocs(collection(db, 'tutorSubjects')).catch(() => ({ docs: [] } as any))
        ]);

        if (!isMounted) return;

        // Process Programs
        const progs: ProgramOption[] = [];
        programsSnap.docs?.forEach((d: any) => {
          const data = d.data();
          progs.push({
            id: d.id,
            title: data.title || data.name || 'Academy Program',
            name: data.name || data.title,
            price: Number(data.price || data.tuition || data.fee || 35000),
            fee: Number(data.fee || data.price || data.tuition || 35000),
            tuition: Number(data.tuition || data.price || data.fee || 35000),
            category: data.category,
            level: data.level,
            duration: data.duration,
            seriesName: data.seriesName,
            hasStages: Boolean(data.hasStages || data.seriesName),
            stageNumber: data.stageNumber,
            stageName: data.stageName,
            isSeries: Boolean(data.isSeries || data.seriesName)
          });
        });
        setProgramsList(progs);

        // Process Tutors (deduplicate & resolve genuine full real names)
        const tutorMap = new Map<string, TutorOption>();
        const emailToRealName = new Map<string, string>();
        const idToRealName = new Map<string, string>();

        // 1. Index real names from tutor applications
        appsSnap.docs?.forEach((d: any) => {
          const data = d.data();
          const email = (data.email || '').toLowerCase().trim();
          const realName = resolveRealName(data, email);
          if (email && realName) emailToRealName.set(email, realName);
          if (realName) idToRealName.set(d.id, realName);
        });

        // 2. Index real names from tutor inquiries
        inquiriesSnap.docs?.forEach((d: any) => {
          const data = d.data();
          const isTutorInquiry = data.type === 'TUTOR_APP' || data.type === 'TUTOR_APPLICATION' || data.inquirySubject?.includes('Tutor');
          if (isTutorInquiry) {
            const email = (data.email || '').toLowerCase().trim();
            const realName = resolveRealName(data, email);
            if (email && realName && !emailToRealName.has(email)) emailToRealName.set(email, realName);
            if (realName && !idToRealName.has(d.id)) idToRealName.set(d.id, realName);
          }
        });

        // Helper to resolve the best name for a record
        const getBestRealName = (dId: string, data: any, email: string) => {
          if (idToRealName.has(dId)) return idToRealName.get(dId)!;
          if (email && emailToRealName.has(email)) return emailToRealName.get(email)!;
          const resolved = resolveRealName(data, email);
          if (email && resolved) emailToRealName.set(email, resolved);
          if (resolved) idToRealName.set(dId, resolved);
          return resolved;
        };

        // 3. Process Tutors Collection
        tutorsSnap.docs?.forEach((d: any) => {
          const data = d.data();
          const email = (data.email || '').toLowerCase().trim();
          const resolvedName = getBestRealName(d.id, data, email);
          
          tutorMap.set(d.id, {
            id: d.id,
            name: resolvedName,
            email: data.email || '',
            phone: data.phone || '',
            qualification: data.qualification || '',
            subjects: data.subjects || []
          });
        });

        // 4. Process Staff Collection
        staffSnap.docs?.forEach((d: any) => {
          const data = d.data();
          const email = (data.email || '').toLowerCase().trim();
          const resolvedName = getBestRealName(d.id, data, email);

          if (!tutorMap.has(d.id)) {
            tutorMap.set(d.id, {
              id: d.id,
              name: resolvedName,
              email: data.email || '',
              phone: data.phone || '',
              qualification: data.qualification || data.role || '',
              subjects: data.subjects || []
            });
          }
        });

        // 5. Process Users Collection (tutors, staff, instructors)
        usersSnap.docs?.forEach((d: any) => {
          const data = d.data();
          const role = String(data.role || '').toLowerCase();
          const isTutorOrStaff = ['tutor', 'instructor', 'staff', 'faculty', 'teacher', 'mentor', 'academic_admin'].includes(role);
          
          if (isTutorOrStaff) {
            const email = (data.email || '').toLowerCase().trim();
            const resolvedName = getBestRealName(d.id, data, email);

            if (!tutorMap.has(d.id)) {
              tutorMap.set(d.id, {
                id: d.id,
                name: resolvedName,
                email: data.email || '',
                phone: data.phone || data.phoneNumber || '',
                qualification: data.qualification || '',
                subjects: data.subjects || []
              });
            }
          }
        });

        // 6. Also incorporate approved applicants from tutor_applications if not yet in tutorsMap
        appsSnap.docs?.forEach((d: any) => {
          const data = d.data();
          const email = (data.email || '').toLowerCase().trim();
          const resolvedName = getBestRealName(d.id, data, email);

          if (!tutorMap.has(d.id) && email) {
            const alreadyExistsByEmail = Array.from(tutorMap.values()).some(t => t.email.toLowerCase().trim() === email);
            if (!alreadyExistsByEmail) {
              tutorMap.set(d.id, {
                id: d.id,
                name: resolvedName,
                email: data.email || '',
                phone: data.phone || '',
                qualification: data.qualification || '',
                subjects: data.subjects || []
              });
            }
          }
        });

        const tutorList = Array.from(tutorMap.values())
          .filter(t => t.name && t.name.trim().length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setTutorsList(tutorList);

        // Prepopulate based on request
        const sName = request.studentName || request.name || 'Student';
        const pEmail = request.parentEmail || request.email || '';
        const rawSubjects = Array.isArray(request.subjects) ? request.subjects.join(', ') : request.subjects || '';
        const requestedPlan = request.plan || '';

        // Generate credentials
        const newCode = makeAccessCode();
        const newUsername = makeUsername(sName, request.id);
        setGeneratedAccessCode(newCode);
        setGeneratedUsername(newUsername);

        // Match Program if any
        let matchedProg = progs.find(p => 
          requestedPlan && p.title.toLowerCase().includes(requestedPlan.toLowerCase())
        ) || progs.find(p => 
          rawSubjects && p.title.toLowerCase().includes(rawSubjects.toLowerCase())
        );

        if (matchedProg) {
          setSelectedProgramId(matchedProg.id);
          setTuitionFee(matchedProg.price || 35000);
        } else if (progs.length > 0) {
          setSelectedProgramId(progs[0].id);
          setTuitionFee(progs[0].price || 35000);
        } else {
          setCustomProgramTitle(requestedPlan || 'Digital Literacy Junior & STEM Program');
          setTuitionFee(35000);
        }

        // Set default tutor if available
        if (tutorList.length > 0) {
          setSelectedTutorId(tutorList[0].id);
        }

      } catch (err) {
        console.error('Error loading enrollment approval options:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, request]);

  if (!isOpen || !request) return null;

  const sName = request.studentName || request.name || 'Student';
  const pName = request.parentName || 'Parent';
  const pEmail = request.parentEmail || request.email || '';
  const pPhone = request.parentPhone || request.phone || '';
  const sAge = request.studentAge || request.studentClass || request.class || request.grade || 'Junior Cadet';

  const handleProgramSelect = (programId: string) => {
    setSelectedProgramId(programId);
    const prog = programsList.find(p => p.id === programId);
    if (prog) {
      setTuitionFee(prog.price || prog.fee || prog.tuition || 35000);
    }
  };

  const toggleSeriesProgram = (programId: string) => {
    setSelectedSeriesProgramIds(prev => {
      const next = prev.includes(programId) ? prev.filter(id => id !== programId) : [...prev, programId];
      // Sum up the tuition fees
      const totalFee = next.reduce((sum, id) => {
        const p = programsList.find(item => item.id === id);
        return sum + (p?.price || p?.fee || 35000);
      }, 0);
      if (totalFee > 0) setTuitionFee(totalFee);
      return next;
    });
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays(prev => {
      if (prev.includes(dayId)) {
        return prev.length === 1 ? prev : prev.filter(d => d !== dayId);
      }
      return [...prev, dayId];
    });
  };

  // Get resolved program title(s)
  const getResolvedProgramDetails = () => {
    if (programMode === 'custom') {
      return {
        programTitle: customProgramTitle.trim() || 'Custom STEM Program',
        enrolledPrograms: [customProgramTitle.trim() || 'Custom STEM Program'],
        programIds: []
      };
    }
    if (programMode === 'series') {
      const selected = programsList.filter(p => selectedSeriesProgramIds.includes(p.id));
      if (selected.length > 0) {
        return {
          programTitle: selected.map(p => p.title).join(' + '),
          enrolledPrograms: selected.map(p => p.title),
          programIds: selected.map(p => p.id)
        };
      }
      return {
        programTitle: 'Multi-Program Technology Track Series',
        enrolledPrograms: ['Multi-Program Technology Track Series'],
        programIds: []
      };
    }
    const single = programsList.find(p => p.id === selectedProgramId);
    return {
      programTitle: single?.title || customProgramTitle || 'Digital Literacy Junior',
      enrolledPrograms: [single?.title || customProgramTitle || 'Digital Literacy Junior'],
      programIds: single ? [single.id] : []
    };
  };

  // Get resolved tutor details
  const getResolvedTutor = () => {
    if (selectedTutorId === 'custom' || (!selectedTutorId && customTutorName)) {
      return {
        tutorId: 'custom_tutor',
        tutorName: customTutorName.trim() || 'Assigned Instructor',
        tutorEmail: customTutorEmail.trim() || 'faculty@jaystarbliss.com',
        role: tutorRole
      };
    }
    const tutor = tutorsList.find(t => t.id === selectedTutorId);
    return {
      tutorId: tutor?.id || 'tutor_default',
      tutorName: tutor?.name || customTutorName || 'Jaystarbliss Lead Mentor',
      tutorEmail: tutor?.email || customTutorEmail || 'faculty@jaystarbliss.com',
      role: tutorRole
    };
  };

  // Format schedule text summary
  const getScheduleSummary = () => {
    const daysStr = selectedDays.join(' & ');
    const modeStr = deliveryMode === 'online' ? `Online Live (${meetingLink || 'Google Meet'})` : `Physical Lab (${locationRoom})`;
    return `${daysStr} from ${startTime} to ${endTime} • ${modeStr}`;
  };

  // Main Submit Approval Handler
  const handleApproveStudent = async () => {
    if (!generatedUsername.trim() || !generatedAccessCode.trim()) {
      toast.error('Student credentials are required.');
      return;
    }

    if (tuitionFee <= 0) {
      toast.error('Please input a valid tuition fee amount.');
      return;
    }

    if (selectedDays.length === 0) {
      toast.error('Please select at least one class schedule day.');
      return;
    }

    setSubmitting(true);

    try {
      const studentDocId = `student_${request.id}`;
      const { programTitle, enrolledPrograms, programIds } = getResolvedProgramDetails();
      const tutor = getResolvedTutor();
      const scheduleSummary = getScheduleSummary();
      const parentId = request.parentId || pEmail || null;

      // Extract subject list
      const subjectsArray = Array.isArray(request.subjects) 
        ? request.subjects 
        : String(request.subjects || programTitle).split(',').map(s => s.trim()).filter(Boolean);

      // 1. Prepare Student Master Object
      const studentMasterRecord = {
        id: studentDocId,
        fullName: sName,
        name: sName,
        username: generatedUsername.trim(),
        accessCode: generatedAccessCode.trim(),
        email: (request.email || `${generatedUsername.trim()}@jaystarbliss.cadet`).toLowerCase(),
        studentEmail: (request.email || `${generatedUsername.trim()}@jaystarbliss.cadet`).toLowerCase(),
        phone: request.phone || '',
        grade: sAge,
        class: sAge,
        track: programTitle,
        plan: programTitle,
        programId: programIds[0] || null,
        programName: programTitle,
        programTitle: programTitle,
        enrolledPrograms,
        tuitionFee: Number(tuitionFee),
        fee: Number(tuitionFee),
        currency: 'NGN',
        feePlanType,
        paymentTermsNote,
        paymentStatus: 'PENDING',
        tutorId: tutor.tutorId,
        tutorName: tutor.tutorName,
        tutorEmail: tutor.tutorEmail,
        mentorName: tutor.tutorName,
        assignedTutors: [
          {
            tutorId: tutor.tutorId,
            tutorName: tutor.tutorName,
            tutorEmail: tutor.tutorEmail,
            role: tutor.role,
            trackOrSubject: programTitle
          }
        ],
        schedule: scheduleSummary,
        classScheduleDetails: {
          days: selectedDays,
          startTime,
          endTime,
          deliveryMode,
          meetingLink: deliveryMode === 'online' ? meetingLink : '',
          locationRoom: deliveryMode !== 'online' ? locationRoom : '',
          recurrenceWeeks
        },
        parentId,
        parentEmail: pEmail,
        parentName: pName,
        parentPhone: pPhone,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        portalAccessEnabled: true,
        registrationSource: 'parent-enrollment-approved',
        enrollmentRequestId: request.id,
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 2. Write to both 'students' and 'individualStudents' collections
      await Promise.all([
        setDoc(doc(db, 'students', studentDocId), studentMasterRecord, { merge: true }),
        setDoc(doc(db, 'individualStudents', studentDocId), {
          ...studentMasterRecord,
          firebaseUid: null
        }, { merge: true })
      ]);

      // 3. Upsert into 'users' collection with role 'STUDENT'
      await setDoc(doc(db, 'users', studentDocId), {
        id: studentDocId,
        uid: studentDocId,
        email: studentMasterRecord.email,
        displayName: sName,
        fullName: sName,
        username: generatedUsername.trim(),
        accessCode: generatedAccessCode.trim(),
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        status: 'ACTIVE',
        parentId,
        parentEmail: pEmail,
        plan: programTitle,
        programName: programTitle,
        tutorName: tutor.tutorName,
        schedule: scheduleSummary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => console.warn('Users collection write warning:', err));

      // 4. Create Recurring Class Schedules in 'classSchedules' collection
      const schedulePromises: Promise<any>[] = [];
      const now = new Date();

      selectedDays.forEach(dayName => {
        const dayConfig = DAYS_OF_WEEK.find(d => d.id === dayName);
        const targetDayIndex = dayConfig ? dayConfig.dayIndex : 6;

        for (let week = 0; week < recurrenceWeeks; week++) {
          const occDate = new Date(now);
          // Calculate target day in current or future week
          const currentDayIndex = occDate.getDay();
          let diffDays = targetDayIndex - currentDayIndex;
          if (diffDays < 0 || (diffDays === 0 && week === 0)) {
            diffDays += 7;
          }
          occDate.setDate(occDate.getDate() + diffDays + (week * 7));
          const dateString = occDate.toISOString().split('T')[0];

          const schedulePayload = {
            title: `${programTitle} Session (Week ${week + 1})`,
            programName: programTitle,
            programId: programIds[0] || 'prog_active',
            studentId: studentDocId,
            studentName: sName,
            studentEmail: studentMasterRecord.email,
            parentId,
            parentEmail: pEmail,
            parentName: pName,
            tutorId: tutor.tutorId,
            tutorName: tutor.tutorName,
            tutorEmail: tutor.tutorEmail,
            date: dateString,
            dayOfWeek: dayName,
            startTime,
            endTime,
            targetType: 'parent',
            deliveryMode,
            meetingLink: deliveryMode === 'online' ? meetingLink : '',
            locationRoom: deliveryMode !== 'online' ? locationRoom : '',
            status: 'SCHEDULED',
            occurrenceIndex: week + 1,
            occurrenceTotal: recurrenceWeeks,
            createdAt: serverTimestamp()
          };

          schedulePromises.push(
            addDoc(collection(db, 'classSchedules'), schedulePayload).catch(err => {
              console.warn('Schedule addDoc warning:', err);
            })
          );
        }
      });

      await Promise.all(schedulePromises);

      // 5. Send Parent Portal Notification
      if (sendParentNotification && (parentId || pEmail)) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: parentId || pEmail,
          recipientEmail: pEmail,
          targetRole: 'parent',
          type: 'credential_delivery',
          title: `🎉 Access Granted: ${sName}'s Portal Credentials & Schedule`,
          message: `Congratulations! ${sName} has been approved for "${programTitle}". Student Username: ${generatedUsername.trim()} | Access Code: ${generatedAccessCode.trim()}. Assigned Mentor: ${tutor.tutorName}. Schedule: ${scheduleSummary}. Tuition Fee: ₦${tuitionFee.toLocaleString()}.`,
          metadata: {
            studentId: studentDocId,
            studentName: sName,
            username: generatedUsername.trim(),
            accessCode: generatedAccessCode.trim(),
            programName: programTitle,
            tuitionFee: Number(tuitionFee),
            tutorName: tutor.tutorName,
            scheduleSummary,
            deliveryMode,
            meetingLink: deliveryMode === 'online' ? meetingLink : ''
          },
          priority: 'high',
          read: false,
          readBy: [],
          timestamp: serverTimestamp(),
          senderName: 'Jaystarbliss Admissions Council',
          senderRole: 'Super Admin'
        }).catch(err => console.warn('Parent notification write warning:', err));
      }

      // 6. Record Email Dispatch in 'email_logs'
      if (sendParentEmail && pEmail) {
        await addDoc(collection(db, 'email_logs'), {
          to: pEmail,
          parentName: pName,
          studentName: sName,
          subject: `Jaystarbliss Studios: Student Portal Credentials for ${sName}`,
          credentials: {
            username: generatedUsername.trim(),
            accessCode: generatedAccessCode.trim(),
            portalUrl: `${window.location.origin}/portal`,
            program: programTitle,
            tutor: tutor.tutorName,
            schedule: scheduleSummary,
            fee: tuitionFee
          },
          status: 'QUEUED_SENT',
          sentAt: serverTimestamp()
        }).catch(err => console.warn('Email logs warning:', err));
      }

      // 7. Update the Enrollment Request status in Firestore
      const updateData = {
        status: 'approved',
        studentId: studentDocId,
        username: generatedUsername.trim(),
        accessCode: generatedAccessCode.trim(),
        programName: programTitle,
        tuitionFee: Number(tuitionFee),
        tutorName: tutor.tutorName,
        tutorId: tutor.tutorId,
        schedule: scheduleSummary,
        approvedAt: serverTimestamp()
      };

      // Try updating in 'enrollment_requests' and 'student_requests'
      await updateDoc(doc(db, 'enrollment_requests', request.id), updateData).catch(async () => {
        await updateDoc(doc(db, 'student_requests', request.id), updateData).catch(() => undefined);
      });

      // 8. Log in activity logs
      await addDoc(collection(db, 'activityLogs'), {
        actorRole: 'SUPER_ADMIN',
        action: 'STUDENT_ENROLLMENT_APPROVED',
        targetId: studentDocId,
        targetType: 'student',
        timestamp: serverTimestamp(),
        metadata: {
          studentName: sName,
          parentEmail: pEmail,
          program: programTitle,
          fee: tuitionFee,
          tutor: tutor.tutorName,
          accessCode: generatedAccessCode.trim()
        }
      }).catch(() => undefined);

      toast.success(`Access Approved! Credentials generated for ${sName}.`);

      const resultPayload = {
        studentId: studentDocId,
        studentName: sName,
        username: generatedUsername.trim(),
        accessCode: generatedAccessCode.trim(),
        programTitle,
        tuitionFee,
        tutorName: tutor.tutorName,
        scheduleSummary,
        parentEmail: pEmail
      };

      setApprovedResult(resultPayload);
      if (onSuccess) onSuccess(resultPayload);

    } catch (err: any) {
      console.error('Failed to approve student enrollment:', err);
      toast.error(err?.message || 'Failed to approve student access. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentialsText = () => {
    if (!approvedResult) return;
    const text = `🎉 Jaystarbliss Studios Student Access Credentials:\nStudent: ${approvedResult.studentName}\nUsername: ${approvedResult.username}\nAccess Code: ${approvedResult.accessCode}\nProgram: ${approvedResult.programTitle}\nMentor: ${approvedResult.tutorName}\nClass Schedule: ${approvedResult.scheduleSummary}\nTuition Fee: ₦${approvedResult.tuitionFee.toLocaleString()}\nStudent Portal: ${window.location.origin}/portal`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('Full credential bundle copied to clipboard!');
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const copyCodeOnly = () => {
    if (!approvedResult) return;
    navigator.clipboard.writeText(approvedResult.accessCode);
    setCopiedCode(true);
    toast.success('Access code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center font-black">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {approvedResult ? 'Student Access Approved!' : 'Approve & Onboard Student'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {approvedResult 
                  ? 'Credentials have been created and dispatched to the parent portal.' 
                  : `Configure program track, tuition fee, mentor, and class schedule for ${sName}.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-900 dark:text-slate-100">
          
          {loadingInitial ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 size={28} className="animate-spin text-brand-red" />
              <p className="text-xs font-bold text-slate-500">Loading program catalog and faculty tutors...</p>
            </div>
          ) : approvedResult ? (
            /* SUCCESS CONFIRMATION VIEW */
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                    Portal Account Successfully Activated!
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {sName}'s student profile is active. The class timetable and learning workspace are now live. Credentials have been sent to {pName}'s parent dashboard inbox.
                  </p>
                </div>
              </div>

              {/* Credentials Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Student Access Keys</span>
                  <button
                    type="button"
                    onClick={copyCredentialsText}
                    className="text-[11px] font-bold text-brand-red hover:text-red-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedAll ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedAll ? 'Copied Bundle!' : 'Copy Full Details'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Login Username</span>
                    <span className="font-mono font-bold text-white text-sm break-all">{approvedResult.username}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Access Code / PIN</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">{approvedResult.accessCode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCodeOnly}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      title="Copy Code"
                    >
                      {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block">Enrolled Program:</span>
                    <span className="font-bold text-slate-200">{approvedResult.programTitle}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Assigned Mentor:</span>
                    <span className="font-bold text-slate-200">{approvedResult.tutorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Configured Fee:</span>
                    <span className="font-bold text-emerald-400">₦{approvedResult.tuitionFee.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Schedule:</span>
                    <span className="font-bold text-slate-200 truncate block">{approvedResult.scheduleSummary}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold transition-all"
                >
                  Done &amp; Close
                </button>
              </div>
            </div>
          ) : (
            /* ONBOARDING & CONFIGURATION FORM */
            <div className="space-y-5">
              
              {/* Applicant Overview Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrollment Applicant</span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{sName}</h3>
                  <p className="text-[11px] text-slate-500">
                    Grade / Age: <strong className="text-slate-700 dark:text-slate-300">{sAge}</strong> • Parent: <strong className="text-slate-700 dark:text-slate-300">{pName} ({pEmail || 'N/A'})</strong>
                  </p>
                </div>
                {request.plan && (
                  <span className="px-2.5 py-1 rounded-full bg-brand-red/10 text-brand-red font-bold text-[10px]">
                    Requested: {request.plan}
                  </span>
                )}
              </div>

              {/* 1. PROGRAM SELECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-brand-red" /> 1. Select Programme Track / Series *
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setProgramMode('single')}
                      className={`px-2 py-0.5 rounded-md transition-all ${programMode === 'single' ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-red' : 'text-slate-500'}`}
                    >
                      Single Course
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgramMode('series')}
                      className={`px-2 py-0.5 rounded-md transition-all ${programMode === 'series' ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-red' : 'text-slate-500'}`}
                    >
                      Series / Bundle
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgramMode('custom')}
                      className={`px-2 py-0.5 rounded-md transition-all ${programMode === 'custom' ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-red' : 'text-slate-500'}`}
                    >
                      Custom Track
                    </button>
                  </div>
                </div>

                {programMode === 'single' && (
                  <select
                    value={selectedProgramId}
                    onChange={(e) => handleProgramSelect(e.target.value)}
                    className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-brand-red outline-none"
                  >
                    {programsList.map(prog => (
                      <option key={prog.id} value={prog.id}>
                        {prog.title} {prog.price ? `(₦${prog.price.toLocaleString()})` : ''} {prog.seriesName ? `• ${prog.seriesName}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {programMode === 'series' && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 max-h-36 overflow-y-auto">
                    <p className="text-[10px] text-slate-400 font-medium">Select all programs in this bundle/stage track:</p>
                    {programsList.map(prog => {
                      const isSelected = selectedSeriesProgramIds.includes(prog.id);
                      return (
                        <div
                          key={prog.id}
                          onClick={() => toggleSeriesProgram(prog.id)}
                          className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-brand-red/10 border-brand-red text-brand-red font-bold' 
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-slate-400" />}
                            <span className="truncate">{prog.title}</span>
                          </div>
                          <span className="text-[10px] opacity-80 shrink-0">₦{(prog.price || 35000).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {programMode === 'custom' && (
                  <input
                    type="text"
                    value={customProgramTitle}
                    onChange={e => setCustomProgramTitle(e.target.value)}
                    placeholder="e.g. Robotics, Artificial Intelligence & Python Masterclass"
                    className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-brand-red outline-none"
                  />
                )}
              </div>

              {/* 2. TUITION FEE & BILLING CONFIGURATION */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-brand-red" /> 2. Set Tuition Fee &amp; Parent Billing (₦) *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Tuition Fee to Pay (Naira)</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₦</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={tuitionFee}
                        onChange={e => setTuitionFee(Number(e.target.value))}
                        className="w-full min-h-10 pl-7 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-black focus:ring-2 focus:ring-brand-red outline-none"
                        placeholder="35000"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Fee Term / Structure</span>
                    <select
                      value={feePlanType}
                      onChange={e => setFeePlanType(e.target.value)}
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-brand-red outline-none"
                    >
                      <option value="Full Session Tuition">Full Session Tuition (Termly)</option>
                      <option value="Monthly Subscription">Monthly Subscription Plan</option>
                      <option value="Special Agreed Fee">Special Agreed / Discounted Rate</option>
                      <option value="Full Scholarship">Full Scholarship / Sponsored (₦0)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. TUTOR & MENTOR ASSIGNMENT */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User size={14} className="text-brand-red" /> 3. Assign Faculty Tutor / Lead Mentor *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Select Registered Tutor</span>
                    <select
                      value={selectedTutorId}
                      onChange={e => setSelectedTutorId(e.target.value)}
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-brand-red outline-none"
                    >
                      {tutorsList.map(t => (
                        <option key={t.id} value={t.id}>
                          {formatTutorDropdownLabel(t.name, t.email, t.qualification)}
                        </option>
                      ))}
                      <option value="custom">+ Enter Custom / Guest Tutor</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Role / Specialization</span>
                    <input
                      type="text"
                      value={tutorRole}
                      onChange={e => setTutorRole(e.target.value)}
                      placeholder="e.g. Lead Mentor, Robotics Coach"
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-brand-red outline-none"
                    />
                  </div>
                </div>

                {selectedTutorId === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <input
                      type="text"
                      value={customTutorName}
                      onChange={e => setCustomTutorName(e.target.value)}
                      placeholder="Custom Tutor Full Name"
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium"
                    />
                    <input
                      type="email"
                      value={customTutorEmail}
                      onChange={e => setCustomTutorEmail(e.target.value)}
                      placeholder="tutor@jaystarbliss.com"
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>
                )}
              </div>

              {/* 4. CLASS SCHEDULE CONFIGURATION */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar size={14} className="text-brand-red" /> 4. Create Child's Class Schedule *
                </label>

                {/* Day selector pills */}
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Active Class Days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map(d => {
                      const isSelected = selectedDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDay(d.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-brand-red text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time & Delivery Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Start Time</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">End Time</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Delivery Format</span>
                    <select
                      value={deliveryMode}
                      onChange={e => setDeliveryMode(e.target.value as any)}
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold"
                    >
                      <option value="online">Online Live Meeting</option>
                      <option value="physical">Physical Lab / Studio</option>
                      <option value="hybrid">Hybrid (Lab &amp; Online)</option>
                    </select>
                  </div>
                </div>

                {/* Meeting Link or Physical Lab Location */}
                {deliveryMode === 'online' ? (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Virtual Classroom Link (Google Meet / Zoom)</span>
                    <div className="relative">
                      <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="url"
                        value={meetingLink}
                        onChange={e => setMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/xxx-yyyy-zzz"
                        className="w-full min-h-10 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Lab / Classroom Location</span>
                    <input
                      type="text"
                      value={locationRoom}
                      onChange={e => setLocationRoom(e.target.value)}
                      placeholder="e.g. Innovation Lab Room 3A, Abuja Central"
                      className="w-full min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              {/* 5. CREDENTIALS & DISPATCH TOGGLES */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-emerald-500" /> Auto-Generated Student Keys
                  </span>
                  <span className="text-[10px] text-slate-500">Will be linked to parent account</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] uppercase text-slate-400 block">Username</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{generatedUsername}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] uppercase text-slate-400 block">Access PIN / Code</span>
                    <span className="font-mono font-black text-brand-red">{generatedAccessCode}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendParentNotification}
                      onChange={e => setSendParentNotification(e.target.checked)}
                      className="rounded text-brand-red focus:ring-brand-red"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Deliver to Parent Portal Inbox</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendParentEmail}
                      onChange={e => setSendParentEmail(e.target.checked)}
                      className="rounded text-brand-red focus:ring-brand-red"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Log Email Notification</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveStudent}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{submitting ? 'Approving & Provisioning...' : 'Approve & Create Student Access'}</span>
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
