import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Sun, Moon, CheckCircle2, Users, GraduationCap, AlertCircle, 
  User, Phone, Mail, Lock, ShieldCheck, BookOpen, Contact, UserPlus, Send,
  ArrowRight, ArrowLeft, Briefcase, DollarSign, Calendar, Award, ExternalLink,
  Clock, MapPin, Sparkles
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { collection, addDoc, doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { useTheme } from '../hooks/useTheme';
import ProgressStepper from '../components/ui/ProgressStepper';
import Tooltip from '../components/ui/Tooltip';
import SEO from '../components/ui/SEO';
import { JaystarblissIcon } from '../components/common/JaystarblissLogo';
import { useToast } from '../contexts/ToastContext';
import './Register.css';

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
  const isDarkMode = theme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [mode, setMode] = useState<'parent' | 'student' | 'tutor'>('parent');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
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
  const [studentClass, setStudentClass] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Tutor Specific Fields
  const [location, setLocation] = useState('');
  const [qualification, setQualification] = useState('');
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
  const pwColors = ['#ef4444','#f97316','#eab308','#22c55e'];

  const handleSubjectChange = (subject: string) => {
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
          setError('Please enter a password.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'parent') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        
        let finalRole = email === 'johnrufai242@gmail.com' ? 'super_admin' : 'parent';
        try {
          const inviteDocRef = doc(db, 'invites', email.toLowerCase());
          const inviteSnap = await getDoc(inviteDocRef);
          if (inviteSnap.exists()) {
             finalRole = inviteSnap.data().role.toLowerCase();
             await deleteDoc(inviteDocRef);
          }
        } catch(e) {
          console.error(e);
        }
        
        const data = {
          name: fullName,
          email: email.toLowerCase(),
          phone,
          role: finalRole,
          children: [],
          emailVerified: false,
          createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'parents', cred.user.uid), data);
        await setDoc(doc(db, 'users', cred.user.uid), data);
        
        sessionStorage.setItem('userId', cred.user.uid);
        sessionStorage.setItem('userRole', 'parent');
        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('userName', fullName);
        
        setSuccess('Account created! A verification email has been sent. Redirecting to dashboard...');
        toast.success('Account created successfully! Verification email has been sent.');
        
        setTimeout(() => {
          navigate('/portal/parent');
        }, 1500);
      } catch (err: any) {
        let msg = 'Registration failed. Please try again.';
        if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Try logging in instead.';
        if (err.code === 'auth/weak-password') msg = 'Password too weak — use at least 8 characters.';
        if (err.code === 'auth/invalid-email') msg = 'Please enter a valid email address.';
        if (err.code === 'auth/network-request-failed') msg = 'Network error. Please check your connection.';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    } else if (mode === 'student') {
      // Student Request
      try {
        await addDoc(collection(db, 'student_requests'), {
          name: fullName,
          email: email.toLowerCase(),
          phone,
          class: studentClass,
          parentPhone,
          subjects: selectedSubjects,
          notes,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        setSuccess('Student registration request submitted! An admin will review and email your access code within 24 hours.');
        toast.success('Student registration request submitted! Check your email for login & access details.');
        // Clear form
        setFullName(''); setPhone(''); setEmail(''); setStudentClass(''); setParentPhone('');
        setSelectedSubjects([]); setNotes('');
        setCurrentStep(0);
      } catch (err) {
        setError('Error submitting request. Please try again or contact support.');
        toast.error('Error submitting student request. Please try again or reach out on WhatsApp.');
        console.error('Student request error:', err);
      } finally {
        setLoading(false);
      }
    } else if (mode === 'tutor') {
      // Tutor / Instructor Application
      try {
        await addDoc(collection(db, 'tutor_applications'), {
          name: fullName,
          email: email.toLowerCase(),
          phone,
          location,
          qualification,
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
        
        setSuccess('Instructor Application submitted successfully! Our Academic Directorate will review your credentials and schedule an interview/onboarding session.');
        toast.success('Instructor application submitted successfully! Our Directorate will contact you soon.');
        
        // Clear form
        setFullName(''); setPhone(''); setEmail(''); setLocation(''); setQualification('');
        setCvUrl(''); setSelectedSubjects([]); setExpectedSalary(''); setTutorBio('');
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

  return (
    <div className="register-page">
      <SEO 
        title="Student, Parent & Tutor Registration | Jaystarbliss Studios" 
        description="Register for coding programs, STEM tutoring, robotics courses, academic tracks, or apply as an expert tutor at Jaystarbliss Studios." 
      />
      {/* NAV */}
      <nav className="reg-nav">
        <div className="reg-nav-inner">
          <Link to="/" className="reg-nav-brand group">
            <JaystarblissIcon className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl group-hover:scale-105 transition-transform shadow-sm" />
            <span className="reg-nav-brand-name">
              Jaystarbliss <span style={{ color: 'var(--madder)' }}>Studios</span>
            </span>
          </Link>
          <div className="reg-nav-actions">
            <Tooltip content="Toggle dark/light theme" placement="bottom">
              <button className="reg-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {isDarkMode ? <Moon className="w-[15px] h-[15px]" /> : <Sun className="w-[15px] h-[15px]" />}
              </button>
            </Tooltip>
            <Link to="/portal" className="reg-nav-login">Sign In &rarr;</Link>
          </div>
        </div>
      </nav>

      {/* PAGE LAYOUT */}
      <div className="reg-page-layout">

        {/* LEFT HERO PANEL */}
        <section className="reg-hero-panel">
          <div className="reg-hero-content">
            <h1 className="reg-hero-headline">
              {mode === 'tutor' ? (
                <>
                  Shape The<br />
                  <em>Next Generation</em><br />
                  Of Tech & STEM<br />
                  Pioneers.
                </>
              ) : (
                <>
                  Ignite Your<br />
                  <em>Potential</em><br />
                  With Expert<br />
                  Mentorship.
                </>
              )}
            </h1>
            <p className="reg-hero-sub">
              {mode === 'tutor' 
                ? 'Join Jaystarbliss Studios as a distinguished instructor. Teach coding, AI, robotics, sciences, and mathematics while enjoying competitive compensation.' 
                : 'Join a community dedicated to mastery and brilliance. Your journey begins with a single step.'}
            </p>
          </div>
          <div className="reg-hero-features">
            <div className="reg-hero-feature">
              <div className="reg-hero-feature-icon red">
                <CheckCircle2 />
              </div>
              <div>
                <div className="reg-hero-feature-title">
                  {mode === 'tutor' ? 'Flexible Schedules' : 'Personalized Learning'}
                </div>
                <div className="reg-hero-feature-desc">
                  {mode === 'tutor' 
                    ? 'Choose your preferred teaching days, hours, and delivery format (Online or In-Person).' 
                    : 'Tailored curriculums for every unique student and pacing requirement.'}
                </div>
              </div>
            </div>
            <div className="reg-hero-feature">
              <div className="reg-hero-feature-icon gold">
                {mode === 'tutor' ? <Award /> : <Users />}
              </div>
              <div>
                <div className="reg-hero-feature-title">
                  {mode === 'tutor' ? 'Competitive Renumeration' : 'Expert Tutors'}
                </div>
                <div className="reg-hero-feature-desc">
                  {mode === 'tutor' 
                    ? 'Prompt monthly payments, curriculum kits, and professional growth opportunities.' 
                    : 'Learn from top industry software engineers and certified academic scholars.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT FORM PANEL */}
        <section className="reg-form-panel">
          <div className="reg-form-card">
            
            <div className="reg-form-heading">
              <h2>
                {mode === 'parent' && 'Create Parent Account'}
                {mode === 'student' && 'Request Student Access'}
                {mode === 'tutor' && 'Apply as Tutor / Mentor'}
              </h2>
              <p>
                {mode === 'parent' && 'Monitor your child’s progress and manage tuition.'}
                {mode === 'student' && 'Apply for access codes to your courses & coding labs.'}
                {mode === 'tutor' && 'Submit your credentials to join our instructional faculty.'}
              </p>
            </div>

            {/* 3-MODE TOGGLE */}
            <div className="reg-mode-toggle">
              <button 
                type="button"
                className={`reg-mode-btn ${mode === 'parent' ? 'active' : ''}`}
                onClick={() => { setMode('parent'); setCurrentStep(0); setError(''); setSuccess(''); }}
              >
                <Users size={14} />
                Parent
              </button>
              <button 
                type="button"
                className={`reg-mode-btn ${mode === 'student' ? 'active' : ''}`}
                onClick={() => { setMode('student'); setCurrentStep(0); setError(''); setSuccess(''); }}
              >
                <GraduationCap size={14} />
                Student
              </button>
              <button 
                type="button"
                className={`reg-mode-btn ${mode === 'tutor' ? 'active' : ''}`}
                onClick={() => { setMode('tutor'); setCurrentStep(0); setError(''); setSuccess(''); }}
              >
                <Briefcase size={14} />
                Tutor / Mentor
              </button>
            </div>

            {/* VISUAL PROGRESS STEPPER */}
            <div className="mb-8 pt-2">
              <ProgressStepper
                steps={steps}
                currentStep={currentStep}
                onStepClick={(idx) => {
                  if (idx < currentStep) setCurrentStep(idx);
                }}
                allowStepClick={true}
              />
            </div>

            {/* ALERTS */}
            {error && (
              <div className="reg-alert error" role="alert">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="reg-alert success" role="status">
                <CheckCircle2 />
                <span>{success}</span>
              </div>
            )}

            {/* FORM */}
            <form className="reg-form" onSubmit={handleSubmit} noValidate>
              
              {/* STEP 1: CONTACT / BASIC INFO */}
              {currentStep === 0 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="reg-info-box" style={{ marginBottom: '1rem' }}>
                    <strong>Step 1 of 3:</strong> Enter your identity and contact information.
                  </div>

                  <div className="reg-form-row">
                    <div className="reg-form-group">
                      <label htmlFor="fullName">Full Name *</label>
                      <div className="reg-input-wrap">
                        <User />
                        <input 
                          type="text" 
                          id="fullName" 
                          value={fullName} 
                          onChange={e => setFullName(e.target.value)} 
                          placeholder="e.g. Samuel Adewale" 
                          required 
                        />
                      </div>
                    </div>
                    <div className="reg-form-group">
                      <label htmlFor="phone">Phone / WhatsApp Number *</label>
                      <div className="reg-input-wrap">
                        <Phone />
                        <input 
                          type="tel" 
                          id="phone" 
                          value={phone} 
                          onChange={e => setPhone(e.target.value)} 
                          placeholder="+234 800 000 0000" 
                          required 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="reg-form-group">
                    <label htmlFor="email">Email Address *</label>
                    <div className="reg-input-wrap">
                      <Mail />
                      <input 
                        type="email" 
                        id="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        placeholder="you@email.com" 
                        required 
                      />
                    </div>
                  </div>

                  {/* Tutor Specific Step 1 Fields */}
                  {mode === 'tutor' && (
                    <>
                      <div className="reg-form-row">
                        <div className="reg-form-group">
                          <label htmlFor="tLocation">City / State *</label>
                          <div className="reg-input-wrap">
                            <MapPin />
                            <input 
                              type="text" 
                              id="tLocation" 
                              value={location} 
                              onChange={e => setLocation(e.target.value)} 
                              placeholder="e.g. Ikeja, Lagos" 
                            />
                          </div>
                        </div>

                        <div className="reg-form-group">
                          <label htmlFor="tExperience">Years of Teaching Experience</label>
                          <div className="reg-input-wrap">
                            <Clock />
                            <select 
                              id="tExperience" 
                              value={experienceYears} 
                              onChange={e => setExperienceYears(e.target.value)}
                            >
                              <option>0–1 Year (Junior / Trainee)</option>
                              <option>1–3 Years (Intermediate)</option>
                              <option>3–5 Years (Experienced)</option>
                              <option>5+ Years (Senior Lead Instructor)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="reg-form-group">
                        <label htmlFor="tQual">Highest Qualification / Specialization *</label>
                        <div className="reg-input-wrap">
                          <Award />
                          <input 
                            type="text" 
                            id="tQual" 
                            list="qualifications-list"
                            value={qualification} 
                            onChange={e => setQualification(e.target.value)} 
                            placeholder="e.g. B.Sc Computer Science / Certified STEM Educator" 
                            required 
                          />
                          <datalist id="qualifications-list">
                            {QUALIFICATIONS.map((q, idx) => <option key={idx} value={q} />)}
                          </datalist>
                        </div>
                      </div>

                      <div className="reg-form-group">
                        <label htmlFor="tCv">Portfolio / LinkedIn / CV or Resume Link (Optional)</label>
                        <div className="reg-input-wrap">
                          <ExternalLink />
                          <input 
                            type="url" 
                            id="tCv" 
                            value={cvUrl} 
                            onChange={e => setCvUrl(e.target.value)} 
                            placeholder="https://linkedin.com/in/... or Google Drive link" 
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 2: PARENT SECURITY OR STUDENT/TUTOR SUBJECTS */}
              {currentStep === 1 && mode === 'parent' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="reg-info-box" style={{ marginBottom: '1rem' }}>
                    <strong>Step 2 of 3:</strong> Create a secure password for your Parent Account dashboard.
                  </div>

                  <div className="reg-form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="pPassword">Password *</label>
                    <div className="reg-input-wrap">
                      <Lock />
                      <input 
                        type="password" id="pPassword" 
                        value={password} onChange={e => setPassword(e.target.value)} 
                        placeholder="Min. 8 characters" 
                      />
                    </div>
                    <div className="reg-pw-strength-bar">
                      {[0, 1, 2, 3].map(i => (
                        <div 
                          key={i} 
                          className="reg-pw-seg" 
                          style={{ background: (password.length > 0 && i < pwScore) ? pwColors[pwScore - 1] : '' }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="reg-form-group">
                    <label htmlFor="pConfirm">Confirm Password *</label>
                    <div className="reg-input-wrap">
                      <ShieldCheck />
                      <input 
                        type="password" id="pConfirm" 
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} 
                        placeholder="Repeat your password" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 1 && mode === 'student' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="reg-info-box" style={{ marginBottom: '1rem' }}>
                    <strong>Step 2 of 3:</strong> Select your class level and subjects of interest.
                  </div>

                  <div className="reg-form-row" style={{ marginBottom: '1rem' }}>
                    <div className="reg-form-group">
                      <label htmlFor="sClass">Class / Grade Level</label>
                      <div className="reg-input-wrap">
                        <BookOpen />
                        <select id="sClass" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                          <option value="">Select class</option>
                          <option>Primary 1–3</option>
                          <option>Primary 4–6</option>
                          <option>JSS 1</option><option>JSS 2</option><option>JSS 3</option>
                          <option>SS 1</option><option>SS 2</option><option>SS 3</option>
                          <option>University / Tertiary Cadet</option>
                          <option>Adult / Career Transition</option>
                        </select>
                      </div>
                    </div>
                    <div className="reg-form-group">
                      <label htmlFor="sParentPhone">Parent / Guardian Phone</label>
                      <div className="reg-input-wrap">
                        <Contact />
                        <input type="tel" id="sParentPhone" value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="Emergency contact" />
                      </div>
                    </div>
                  </div>

                  <div className="reg-form-group" style={{ marginBottom: '1rem' }}>
                    <label>Subjects of Interest *</label>
                    <div className="reg-subjects-grid">
                      {SUBJECTS.map((subject, idx) => (
                        <div className="reg-subject-chip" key={idx}>
                          <input 
                            type="checkbox" 
                            id={`subj_${idx}`} 
                            checked={selectedSubjects.includes(subject)}
                            onChange={() => handleSubjectChange(subject)}
                          />
                          <label htmlFor={`subj_${idx}`}>{subject}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TUTOR STEP 2: TEACHING TRACKS & AVAILABILITY */}
              {currentStep === 1 && mode === 'tutor' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="reg-info-box" style={{ marginBottom: '1rem' }}>
                    <strong>Step 2 of 3:</strong> Select the subjects/technologies you can teach and your weekly availability.
                  </div>

                  <div className="reg-form-group" style={{ marginBottom: '1rem' }}>
                    <label>Subjects / Tech Stacks You Can Teach *</label>
                    <p className="text-xs text-gray-500 mb-2">Select all tracks you are confident instructing:</p>
                    <div className="reg-subjects-grid">
                      {SUBJECTS.map((subject, idx) => (
                        <div className="reg-subject-chip" key={idx}>
                          <input 
                            type="checkbox" 
                            id={`tsubj_${idx}`} 
                            checked={selectedSubjects.includes(subject)}
                            onChange={() => handleSubjectChange(subject)}
                          />
                          <label htmlFor={`tsubj_${idx}`}>{subject}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="reg-form-row">
                    <div className="reg-form-group">
                      <label htmlFor="tDays">Weekly Availability Frequency *</label>
                      <div className="reg-input-wrap">
                        <Calendar />
                        <select 
                          id="tDays" 
                          value={daysPerWeek} 
                          onChange={e => setDaysPerWeek(e.target.value)}
                        >
                          {DAYS_OPTIONS.map((d, i) => (
                            <option key={i} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="reg-form-group">
                      <label htmlFor="tSlot">Preferred Class Time Slot</label>
                      <div className="reg-input-wrap">
                        <Clock />
                        <select 
                          id="tSlot" 
                          value={timeSlot} 
                          onChange={e => setTimeSlot(e.target.value)}
                        >
                          {TIME_SLOTS.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & SUBMIT */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="reg-info-box" style={{ marginBottom: '1rem' }}>
                    <strong>Step 3 of 3:</strong> Review your application summary before final submission.
                  </div>

                  {/* Tutor Specific Compensation & Bio */}
                  {mode === 'tutor' && (
                    <div className="space-y-4">
                      <div className="reg-form-group">
                        <label htmlFor="tSalary">Expected Monthly Remuneration / Rate *</label>
                        <div className="reg-input-wrap">
                          <DollarSign />
                          <input 
                            type="text" 
                            id="tSalary" 
                            value={expectedSalary} 
                            onChange={e => setExpectedSalary(e.target.value)} 
                            placeholder="e.g. ₦120,000 – ₦200,000 / month or ₦5,000 / hour" 
                            required 
                          />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Specify your expected monthly remuneration based on your weekly commitment.
                        </p>
                      </div>

                      <div className="reg-form-group">
                        <label htmlFor="tBio">Brief Instructor Bio / Teaching Highlights</label>
                        <textarea 
                          className="reg-input-bare" 
                          id="tBio" 
                          rows={3}
                          value={tutorBio} 
                          onChange={e => setTutorBio(e.target.value)}
                          placeholder="Tell us about your teaching experience, key projects built, or tools you love teaching..." 
                          maxLength={2000}
                        />
                      </div>
                    </div>
                  )}

                  {/* Summary Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 text-sm">
                    <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 font-medium">Application Category:</span>
                      <span className="font-bold text-slate-800 dark:text-white capitalize">
                        {mode === 'tutor' ? 'Instructor / Mentor Faculty' : `${mode} Account`}
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 font-medium">Full Name:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{fullName}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 font-medium">Email:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{email}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 font-medium">Phone:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{phone}</span>
                    </div>
                    {mode === 'tutor' && qualification && (
                      <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 font-medium">Qualification:</span>
                        <span className="font-bold text-slate-800 dark:text-white">{qualification}</span>
                      </div>
                    )}
                    {mode === 'tutor' && daysPerWeek && (
                      <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 font-medium">Availability:</span>
                        <span className="font-bold text-slate-800 dark:text-white">{daysPerWeek}</span>
                      </div>
                    )}
                    {(mode === 'student' || mode === 'tutor') && (
                      <div>
                        <span className="text-slate-500 font-medium block mb-1">
                          Subjects / Tracks Selected ({selectedSubjects.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSubjects.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-brand-red/10 text-brand-red text-xs font-bold rounded-md">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {mode === 'student' && (
                    <div className="reg-form-group">
                      <label htmlFor="sNotes">Learning Goals / Notes (Optional)</label>
                      <textarea 
                        className="reg-input-bare" id="sNotes" 
                        value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Tell us your goals, requirements, or how you heard about us…" 
                        maxLength={2000}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* NAVIGATION BUTTONS */}
              <div className="flex items-center gap-3 pt-4">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                )}

                {currentStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3 px-6 rounded-xl bg-brand-red text-white font-bold text-sm hover:bg-red-700 shadow-md shadow-brand-red/20 transition-all flex items-center justify-center gap-2"
                  >
                    Next Step <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={`flex-1 reg-btn-submit ${loading ? 'loading' : ''}`}
                    disabled={loading}
                  >
                    <div className="reg-spinner"></div>
                    <span className="reg-btn-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      {mode === 'parent' ? <UserPlus size={16} /> : mode === 'student' ? <Send size={16} /> : <Sparkles size={16} />}
                      {mode === 'parent' ? 'Complete Registration' : mode === 'student' ? 'Submit Student Request' : 'Submit Tutor Application'}
                    </span>
                  </button>
                )}
              </div>

            </form>

            <div className="reg-divider">or</div>
            <div className="reg-form-footer">
              Already have an account? <Link to="/portal">Login here</Link>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};

export default Register;
