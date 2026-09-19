import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Sun, Moon, CheckCircle2, Users, GraduationCap, 
  User, Phone, Mail, Lock, BookOpen, 
  ArrowLeft, ArrowRight, Award, Calendar,
  Clock, MapPin, Eye, EyeOff, Check
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { collection, addDoc, doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { useTheme } from '../hooks/useTheme';
import SEO from '../components/ui/SEO';
import { JaystarblissIcon } from '../components/common/JaystarblissLogo';
import { useToast } from '../contexts/ToastContext';
import CyberLiquidButton from '../components/portal/CyberLiquidButton';
import portalWallpaper from '../assets/jdi login bg.png';
import './Portal.css';
import './SecurePortalTheme.css';

type RegisterMode = 'parent' | 'student' | 'tutor';

const SUBJECTS = [
  'Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology',
  'Coding & Scratch (Kids)', 'Python & Data Science', 'Full-Stack Web Dev (React & Node)',
  'Robotics & Embedded IoT', 'Artificial Intelligence & ML', 'UI/UX & Product Design',
  'Graphic Design & Branding', 'Mobile App Development', 'Cybersecurity Basics',
  'WAEC / NECO / IGCSE Prep', 'JAMB / UTME Masterclass', 'Music Theory & Piano',
  'Chess & Cognitive Logic'
];

const QUALIFICATIONS = [
  'B.Sc / B.Eng in Computer Science / Engineering',
  'B.Ed / Certified Education Specialist',
  'M.Sc / Postgraduate Degree',
  'HND / National Diploma',
  'Professional STEM / Coding Instructor',
  'Undergraduate / Student Mentor',
  'Self-Taught Senior Software Developer'
];

const DAYS_OPTIONS = [
  '1–2 Days per Week (Part-time / Weekday Evenings)',
  '3–4 Days per Week (Standard Cohort)',
  '5 Days per Week (Full-Time Academic Instructor)',
  'Weekends Only (Saturday & Sunday Intensive)'
];

const TIME_SLOTS = [
  'Morning Slots (8:00 AM – 12:00 PM)',
  'Afternoon Slots (12:00 PM – 4:00 PM)',
  'Evening Slots (4:00 PM – 8:00 PM)',
  'Flexible / Open Availability'
];

const Register: React.FC = () => {
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [mode, setMode] = useState<RegisterMode>('parent');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Passwords visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Set mode from URL parameter if provided
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'tutor' || urlMode === 'student' || urlMode === 'parent') {
      setMode(urlMode);
    }
  }, [searchParams]);

  // Common Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Parent Fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Student Fields
  const [studentClass, setStudentClass] = useState('JSS 1');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Mathematics', 'Coding & Scratch (Kids)']);
  const [notes, setNotes] = useState('');

  // Tutor Specific Fields
  const [location, setLocation] = useState('');
  const [qualification, setQualification] = useState(QUALIFICATIONS[0]);
  const [cvUrl, setCvUrl] = useState('');
  const [experienceYears, setExperienceYears] = useState('1–3 Years');
  const [daysPerWeek, setDaysPerWeek] = useState(DAYS_OPTIONS[1]);
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[2]);
  const [expectedSalary, setExpectedSalary] = useState('');
  const [tutorBio, setTutorBio] = useState('');

  const parentSteps = [
    { id: 'contact', title: 'Basic Info', subtitle: 'Name & email' },
    { id: 'security', title: 'Security', subtitle: 'Set password' },
    { id: 'review', title: 'Confirmation', subtitle: 'Review & submit' },
  ];

  const studentSteps = [
    { id: 'contact', title: 'Contact Info', subtitle: 'Your details' },
    { id: 'academics', title: 'Subjects', subtitle: 'Class & topics' },
    { id: 'goals', title: 'Goals & Send', subtitle: 'Submit request' },
  ];

  const tutorSteps = [
    { id: 'contact', title: 'Identity & CV', subtitle: 'Contact & degrees' },
    { id: 'specialization', title: 'Teaching Tracks', subtitle: 'Subjects & availability' },
    { id: 'compensation', title: 'Terms & Submit', subtitle: 'Expectations & bio' },
  ];

  const steps = mode === 'parent' ? parentSteps : mode === 'student' ? studentSteps : tutorSteps;

  const handleModeChange = (newMode: RegisterMode) => {
    setMode(newMode);
    setSearchParams({ mode: newMode });
    setCurrentStep(0);
    setError('');
    setSuccess('');
  };

  // Password Strength
  const checkStrength = (pw: string) => {
    const criteria = [
      pw.length >= 8,
      /[A-Z]/.test(pw),
      /[0-9]/.test(pw),
      /[^A-Za-z0-9]/.test(pw)
    ];
    return criteria.filter(Boolean).length;
  };

  const pwScore = checkStrength(password);
  const pwLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const pwColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const validateStep = (stepIdx: number): boolean => {
    setError('');
    
    // Step 0 Validation (Common)
    if (stepIdx === 0) {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return false;
      }
      if (!phone.trim()) {
        setError('Please enter your phone number.');
        return false;
      }
      if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setError('Please enter a valid email address.');
        return false;
      }
      if (mode === 'student' && !studentClass.trim()) {
        setError('Please select or specify your current class or academic level.');
        return false;
      }
      if (mode === 'tutor') {
        if (!qualification.trim()) {
          setError('Please select or specify your highest academic qualification.');
          return false;
        }
      }
      return true;
    }

    // Step 1 Validation
    if (stepIdx === 1) {
      if (mode === 'parent') {
        if (!password) {
          setError('Please enter a secure password.');
          return false;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters long.');
          return false;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return false;
        }
        return true;
      } else if (mode === 'student') {
        if (selectedSubjects.length === 0) {
          setError('Please select at least one subject of interest.');
          return false;
        }
        return true;
      } else if (mode === 'tutor') {
        if (selectedSubjects.length === 0) {
          setError('Please select at least one subject or track you are proficient in teaching.');
          return false;
        }
        if (!daysPerWeek) {
          setError('Please specify your weekly teaching availability.');
          return false;
        }
        return true;
      }
    }

    // Step 2 Validation (Tutor Compensation)
    if (stepIdx === 2 && mode === 'tutor') {
      if (!expectedSalary.trim()) {
        setError('Please provide your expected monthly remuneration or hourly rate.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError('');
      setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateStep(currentStep)) return;

    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'parent') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        await sendEmailVerification(cred.user).catch(() => undefined);
        
        let finalRole = email.trim().toLowerCase() === 'johnrufai242@gmail.com' ? 'super_admin' : 'parent';
        try {
          const inviteDocRef = doc(db, 'invites', email.trim().toLowerCase());
          const inviteSnap = await getDoc(inviteDocRef);
          if (inviteSnap.exists()) {
             finalRole = inviteSnap.data().role.toLowerCase();
             await deleteDoc(inviteDocRef);
          }
        } catch (err) {
          console.error('Invite lookup error:', err);
        }
        
        const data = {
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role: finalRole,
          children: [],
          emailVerified: false,
          createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'parents', cred.user.uid), data);
        await setDoc(doc(db, 'users', cred.user.uid), data);
        
        sessionStorage.setItem('userId', cred.user.uid);
        sessionStorage.setItem('userRole', 'parent');
        sessionStorage.setItem('userEmail', email.trim().toLowerCase());
        sessionStorage.setItem('userName', fullName.trim());
        
        setSuccess('Account created successfully! A verification link has been sent to your email.');
        toast.success('Account created! Welcome to Jaystarbliss Studios.');
        
        setTimeout(() => {
          navigate('/portal/parent');
        }, 1200);
      } catch (err: any) {
        let msg = 'Registration failed. Please try again.';
        if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Try logging in instead.';
        if (err.code === 'auth/weak-password') msg = 'Password is too weak — use at least 8 characters.';
        if (err.code === 'auth/invalid-email') msg = 'Please enter a valid email address.';
        if (err.code === 'auth/network-request-failed') msg = 'Network error. Please check your internet connection.';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    } else if (mode === 'student') {
      try {
        await addDoc(collection(db, 'student_requests'), {
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          class: studentClass.trim(),
          parentPhone: parentPhone.trim(),
          subjects: selectedSubjects,
          notes: notes.trim(),
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        setSuccess('Student registration request submitted! Our academic operations team will review your application and issue your secure portal access credentials within 24 hours.');
        toast.success('Registration request submitted! We will email your access details.');
        
        // Clear form
        setFullName(''); setPhone(''); setEmail(''); setStudentClass('JSS 1'); setParentPhone('');
        setSelectedSubjects(['Mathematics', 'Coding & Scratch (Kids)']); setNotes('');
        setCurrentStep(0);
      } catch (err) {
        setError('Error submitting request. Please try again or reach out to support.');
        toast.error('Error submitting student request. Please try again.');
        console.error('Student request error:', err);
      } finally {
        setLoading(false);
      }
    } else if (mode === 'tutor') {
      try {
        await addDoc(collection(db, 'tutor_applications'), {
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          location: location.trim(),
          qualification: qualification.trim(),
          cvUrl: cvUrl.trim(),
          subjects: selectedSubjects,
          experienceYears,
          daysPerWeek,
          timeSlot,
          expectedSalary: expectedSalary.trim(),
          bio: tutorBio.trim(),
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        setSuccess('Instructor Application submitted! Our Academic Directorate will review your curriculum credentials and schedule your onboarding consultation.');
        toast.success('Instructor application received! Our team will contact you soon.');
        
        // Clear form
        setFullName(''); setPhone(''); setEmail(''); setLocation(''); setQualification(QUALIFICATIONS[0]);
        setCvUrl(''); setSelectedSubjects(['Python & Data Science']); setExpectedSalary(''); setTutorBio('');
        setCurrentStep(0);
      } catch (err: any) {
        setError('Error submitting tutor application. Please try again or contact us.');
        toast.error('Error submitting tutor application. Please try again.');
        console.error('Tutor application error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const tabs: { id: RegisterMode; label: string; icon: React.ReactNode }[] = [
    { id: 'parent', label: 'Parent Account', icon: <Users size={16} /> },
    { id: 'student', label: 'Student Access', icon: <GraduationCap size={16} /> },
    { id: 'tutor', label: 'Instructor / Tutor', icon: <Award size={16} /> },
  ];

  return (
    <div className={`jdh-portal ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="jdh-portal-bg-viewport" aria-hidden="true">
        <img src={portalWallpaper} alt="" />
        <div className="bg-overlay" />
      </div>
      <SEO 
        title="Student, Parent & Tutor Registration | Jaystarbliss Studios" 
        description="Register for coding programs, STEM tutoring, robotics courses, academic tracks, or apply as an expert tutor at Jaystarbliss Studios." 
      />
      <div className="scanlines" />
      
      <div className="card glass-modal-card register-modal-card">
        {/* TOP BRAND HEADER */}
        <div className="glass-header text-center pt-2 pb-4">
          <Link to="/" className="inline-flex items-center gap-3 select-none group mx-auto mb-2" aria-label="Home">
            <JaystarblissIcon className="w-9 h-9 rounded-xl group-hover:scale-105 transition-transform shrink-0" />
            <span className="font-black text-xl tracking-[0.22em] uppercase text-white drop-shadow-md">
              JAYSTARBLISS
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 mb-1">
            Create Your Account
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-md mx-auto">
            {mode === 'parent' && 'Create your parent account to monitor lesson schedules, review assessments, and manage tuition.'}
            {mode === 'student' && 'Apply for secure access credentials to enroll in coding courses, STEM tracks, and live tutoring.'}
            {mode === 'tutor' && 'Join Jaystarbliss Studios faculty. Teach cutting-edge STEM, programming, and academic curricula.'}
          </p>
        </div>

        {/* ROLE SWITCHER TABS */}
        <div className="glass-role-tabs mb-5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`glass-role-tab ${mode === tab.id ? 'active' : ''}`}
              onClick={() => handleModeChange(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* INTERACTIVE FORM BODY */}
        <div className="form-body p-0">
          <div className="pane">
            {/* STEP WIZARD BAR */}
            <div className="step-wizard-bar">
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (idx < currentStep) setCurrentStep(idx);
                      else if (validateStep(currentStep)) setCurrentStep(idx);
                    }}
                    className={`step-wizard-item ${currentStep === idx ? 'active' : currentStep > idx ? 'completed' : ''}`}
                  >
                    {currentStep > idx ? <Check size={12} className="text-emerald-500" /> : <span>0{idx + 1}.</span>}
                    <span>{s.title}</span>
                  </button>
                ))}
              </div>

              {/* FEEDBACK BANNERS */}
              {error && <div className="msg msg-error show" role="alert">{error}</div>}
              {success && <div className="msg msg-success show" role="status">{success}</div>}

              {/* STEP 0: BASIC CONTACT INFO */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <div className="field">
                    <label>Full Name</label>
                    <div className="input-wrap">
                      <span className="input-icon"><User size={15} /></span>
                      <input 
                        type="text" 
                        required 
                        value={fullName} 
                        onChange={e => setFullName(e.target.value)} 
                        placeholder={mode === 'parent' ? 'Parent / Guardian Full Name' : mode === 'tutor' ? 'Instructor Full Name' : 'Student Full Name'} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="field">
                      <label>Email Address</label>
                      <div className="input-wrap">
                        <span className="input-icon"><Mail size={15} /></span>
                        <input 
                          type="email" 
                          required 
                          value={email} 
                          onChange={e => setEmail(e.target.value)} 
                          placeholder="you@example.com" 
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Phone Number</label>
                      <div className="input-wrap">
                        <span className="input-icon"><Phone size={15} /></span>
                        <input 
                          type="tel" 
                          required 
                          value={phone} 
                          onChange={e => setPhone(e.target.value)} 
                          placeholder="+234..." 
                        />
                      </div>
                    </div>
                  </div>

                  {mode === 'student' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="field">
                        <label>Current Class / Grade</label>
                        <div className="input-wrap">
                          <span className="input-icon"><BookOpen size={15} /></span>
                          <select 
                            value={studentClass} 
                            onChange={e => setStudentClass(e.target.value)}
                            className="has-icon"
                          >
                            <option value="Primary 3">Primary 3</option>
                            <option value="Primary 4">Primary 4</option>
                            <option value="Primary 5">Primary 5</option>
                            <option value="Primary 6">Primary 6</option>
                            <option value="JSS 1">JSS 1 (Grade 7)</option>
                            <option value="JSS 2">JSS 2 (Grade 8)</option>
                            <option value="JSS 3">JSS 3 (Grade 9)</option>
                            <option value="SS 1">SS 1 (Grade 10)</option>
                            <option value="SS 2">SS 2 (Grade 11)</option>
                            <option value="SS 3">SS 3 (Grade 12)</option>
                            <option value="Undergraduate">Undergraduate / College</option>
                            <option value="Adult Learner">Adult / Professional Learner</option>
                          </select>
                        </div>
                      </div>

                      <div className="field">
                        <label>Parent / Guardian Phone</label>
                        <div className="input-wrap">
                          <span className="input-icon"><Phone size={15} /></span>
                          <input 
                            type="tel" 
                            value={parentPhone} 
                            onChange={e => setParentPhone(e.target.value)} 
                            placeholder="+234 (Optional)" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === 'tutor' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="field">
                          <label>Location / City</label>
                          <div className="input-wrap">
                            <span className="input-icon"><MapPin size={15} /></span>
                            <input 
                              type="text" 
                              value={location} 
                              onChange={e => setLocation(e.target.value)} 
                              placeholder="e.g. Lagos, Abuja, or Remote" 
                            />
                          </div>
                        </div>

                        <div className="field">
                          <label>Teaching Experience</label>
                          <div className="input-wrap">
                            <span className="input-icon"><Clock size={15} /></span>
                            <select 
                              value={experienceYears} 
                              onChange={e => setExperienceYears(e.target.value)}
                            >
                              <option value="Less than 1 Year">Less than 1 Year</option>
                              <option value="1–3 Years">1–3 Years</option>
                              <option value="3–5 Years">3–5 Years</option>
                              <option value="5+ Years">5+ Years Senior Instructor</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="field">
                        <label>Academic Qualification</label>
                        <div className="input-wrap">
                          <span className="input-icon"><Award size={15} /></span>
                          <select 
                            value={qualification} 
                            onChange={e => setQualification(e.target.value)}
                          >
                            {QUALIFICATIONS.map(q => (
                              <option key={q} value={q}>{q}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="field">
                        <label>CV / Portfolio Link (Optional)</label>
                        <div className="input-wrap">
                          <span className="input-icon"><Award size={15} /></span>
                          <input 
                            type="url" 
                            value={cvUrl} 
                            onChange={e => setCvUrl(e.target.value)} 
                            placeholder="https://linkedin.com/in/... or Google Drive URL" 
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 1: SECURITY / SUBJECTS / SPECIALIZATION */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {mode === 'parent' && (
                    <>
                      <div className="field">
                        <label>Create Password</label>
                        <div className="input-wrap">
                          <span className="input-icon"><Lock size={15} /></span>
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            className="has-eye"
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="At least 8 characters" 
                          />
                          <button 
                            type="button" 
                            className="pw-eye" 
                            onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        {password && (
                          <div className="pw-strength-wrap">
                            <div className="pw-strength-bar">
                              <div 
                                className="pw-strength-fill" 
                                style={{ 
                                  width: `${(pwScore / 4) * 100}%`, 
                                  backgroundColor: pwColors[Math.max(0, pwScore - 1)] || '#ef4444' 
                                }} 
                              />
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: pwColors[Math.max(0, pwScore - 1)] || '#ef4444' }}>
                              {pwLabels[Math.max(0, pwScore - 1)] || 'Too Weak'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="field">
                        <label>Confirm Password</label>
                        <div className="input-wrap">
                          <span className="input-icon"><Lock size={15} /></span>
                          <input 
                            type={showConfirmPassword ? 'text' : 'password'} 
                            className="has-eye"
                            required 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            placeholder="Repeat password" 
                          />
                          <button 
                            type="button" 
                            className="pw-eye" 
                            onClick={() => setShowConfirmPassword(v => !v)}
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {(mode === 'student' || mode === 'tutor') && (
                    <>
                      <div className="field">
                        <div className="flex items-center justify-between mb-2">
                          <label style={{ margin: 0 }}>
                            {mode === 'student' ? 'Select Subjects of Interest' : 'Select Tracks You Can Teach'}
                          </label>
                          <span className="text-[10px] font-mono text-slate-400">
                            {selectedSubjects.length} selected
                          </span>
                        </div>
                        <div className="subject-grid">
                          {SUBJECTS.map(subj => {
                            const selected = selectedSubjects.includes(subj);
                            return (
                              <button
                                key={subj}
                                type="button"
                                onClick={() => handleSubjectToggle(subj)}
                                className={`subject-chip ${selected ? 'selected' : ''}`}
                              >
                                <span>{subj}</span>
                                {selected && <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {mode === 'tutor' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          <div className="field">
                            <label>Weekly Availability</label>
                            <div className="input-wrap">
                              <span className="input-icon"><Calendar size={15} /></span>
                              <select 
                                value={daysPerWeek} 
                                onChange={e => setDaysPerWeek(e.target.value)}
                              >
                                {DAYS_OPTIONS.map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="field">
                            <label>Preferred Time Slot</label>
                            <div className="input-wrap">
                              <span className="input-icon"><Clock size={15} /></span>
                              <select 
                                value={timeSlot} 
                                onChange={e => setTimeSlot(e.target.value)}
                              >
                                {TIME_SLOTS.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* STEP 2: REVIEW & SUBMIT */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {mode === 'parent' && (
                    <div className="review-box">
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">Account Summary</div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-mono">Full Name</span>
                          <span className="font-bold">{fullName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-mono">Email</span>
                          <span className="font-bold">{email}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-mono">Phone</span>
                          <span className="font-bold">{phone}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-mono">Role</span>
                          <span className="font-bold text-brand-red">Parent / Sponsor</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === 'student' && (
                    <>
                      <div className="review-box">
                        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">Request Summary</div>
                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Student</span>
                            <span className="font-bold">{fullName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Class / Level</span>
                            <span className="font-bold">{studentClass}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Email</span>
                            <span className="font-bold">{email}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Phone</span>
                            <span className="font-bold">{phone}</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <strong>Selected Subjects ({selectedSubjects.length}):</strong> {selectedSubjects.join(', ')}
                        </div>
                      </div>

                      <div className="field">
                        <label>Special Learning Goals or Notes (Optional)</label>
                        <textarea 
                          rows={3} 
                          value={notes} 
                          onChange={e => setNotes(e.target.value)} 
                          placeholder="Tell us what you want to achieve or any specific timetable preferences..." 
                        />
                      </div>
                    </>
                  )}

                  {mode === 'tutor' && (
                    <>
                      <div className="field">
                        <label>Expected Remuneration / Rate</label>
                        <div className="input-wrap">
                          <input 
                            type="text" 
                            required 
                            value={expectedSalary} 
                            onChange={e => setExpectedSalary(e.target.value)} 
                            placeholder="e.g. ₦150,000 / month or ₦5,000 / hour" 
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label>Brief Bio & Teaching Philosophy</label>
                        <textarea 
                          rows={3} 
                          value={tutorBio} 
                          onChange={e => setTutorBio(e.target.value)} 
                          placeholder="Highlight your key achievements, programming stack, or pedagogical approach..." 
                        />
                      </div>

                      <div className="review-box">
                        <div className="text-[11px] text-slate-400">
                          <strong>Tracks ({selectedSubjects.length}):</strong> {selectedSubjects.slice(0, 4).join(', ')}{selectedSubjects.length > 4 ? ` + ${selectedSubjects.length - 4} more` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          <strong>Availability:</strong> {daysPerWeek} · {timeSlot}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="mt-6 flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                )}

                <div className="flex-1">
                  {currentStep < steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-red text-white text-xs font-black uppercase tracking-wider hover:bg-red-700 shadow-md transition"
                    >
                      Continue to Step 0{currentStep + 2} <ArrowRight size={14} />
                    </button>
                  ) : (
                    <CyberLiquidButton 
                      type="button" 
                      onClick={() => handleSubmit()} 
                      loading={loading}
                    >
                      {mode === 'parent' ? 'CREATE PARENT ACCOUNT →' : mode === 'student' ? 'SUBMIT STUDENT REQUEST →' : 'SUBMIT TUTOR APPLICATION →'}
                    </CyberLiquidButton>
                  )}
                </div>
              </div>

              {/* TOGGLE TO SIGN IN */}
              <div className="toggle-link">
                Already registered? <Link to="/portal">Sign In to Portal Hub →</Link>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="glass-footer flex items-center justify-between pt-4 mt-6 border-t border-white/10 text-xs text-slate-400">
            <Link to="/" className="back-link inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
              <ArrowLeft size={14} /> Main Site
            </Link>
            
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Secure Registration
              </span>
              <button 
                type="button" 
                className="theme-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all" 
                onClick={toggleTheme} 
                title="Toggle theme"
              >
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Register;
