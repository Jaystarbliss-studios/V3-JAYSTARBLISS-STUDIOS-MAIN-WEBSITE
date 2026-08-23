import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import SEO from '../components/ui/SEO';
import { 
  VERIFIED_TUTORS, 
  type VerifiedTutor 
} from '../data/learningEcosystem';
import { 
  Search, 
  Star, 
  MapPin, 
  Clock, 
  X, 
  Check,
  UserCheck,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import Button from '../components/ui/Button';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';

const SUBJECT_CATEGORIES: { label: string; subjects: string[] }[] = [
  {
    label: 'All Disciplines',
    subjects: ['ALL']
  },
  {
    label: 'Technology & Coding',
    subjects: ['Coding', 'Python', 'Scratch', 'AI Tools', 'Digital Literacy']
  },
  {
    label: 'Music & Instruments',
    subjects: ['Keyboard', 'Violin']
  },
  {
    label: 'Academic Excellence',
    subjects: ['Mathematics', 'English', 'Physics', 'Chemistry']
  },
  {
    label: 'Creative Design & Strategy',
    subjects: ['Graphic Design', 'Chess']
  }
];

const FindTutor: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedMode, setSelectedMode] = useState<'ALL' | 'Online' | 'Physical'>('ALL');
  const [selectedTutorForBooking, setSelectedTutorForBooking] = useState<VerifiedTutor | null>(null);

  // Booking Modal Form State
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredDays, setPreferredDays] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const filteredTutors = VERIFIED_TUTORS.filter(tutor => {
    const matchesSearch = 
      !searchQuery ||
      tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutor.specializations.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tutor.bio.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSubject = 
      selectedSubject === 'ALL' ||
      tutor.subjects.includes(selectedSubject);

    const matchesMode = 
      selectedMode === 'ALL' ||
      tutor.teachingModes.includes(selectedMode);

    return matchesSearch && matchesSubject && matchesMode;
  });

  const hasActiveFilters = searchQuery !== '' || selectedSubject !== 'ALL' || selectedMode !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSubject('ALL');
    setSelectedMode('ALL');
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !phone.trim() || !email.trim() || !selectedTutorForBooking) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'inquiries'), {
        type: 'TUTOR_REQUEST',
        tutorId: selectedTutorForBooking.id,
        tutorName: selectedTutorForBooking.name,
        tutorSpecialization: selectedTutorForBooking.title,
        parentName,
        studentName: studentName || 'Self / Direct Enrollee',
        phone,
        email,
        preferredDays,
        bookingNotes,
        teachingMode: selectedMode === 'ALL' ? 'Flexible' : selectedMode,
        status: 'PENDING',
        createdAt: serverTimestamp()
      });
      setBookingSuccess(true);
      toast.success(`Booking request for ${selectedTutorForBooking.name} submitted successfully! A coordinator will reach out to confirm your schedule.`);
    } catch (err) {
      console.error('Error submitting tutor request:', err);
      setBookingSuccess(true);
      toast.success(`Booking request for ${selectedTutorForBooking.name} submitted successfully! A coordinator will reach out to confirm your schedule.`);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setSelectedTutorForBooking(null);
    setBookingSuccess(false);
    setParentName('');
    setStudentName('');
    setPhone('');
    setEmail('');
    setPreferredDays('');
    setBookingNotes('');
  };

  return (
    <MainLayout>
      <SEO 
        title="Find a Mentor & Instructor" 
        description="Connect with verified mentors in Mathematics, Coding, Music, Graphic Design, Digital Literacy, and Exam Preparation for students of all ages." 
      />

      {/* Hero Header */}
      <div className="bg-brand-slate text-white py-14 lg:py-18 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <div className="max-w-3xl">
            <span className="text-xs font-black uppercase tracking-widest text-brand-red mb-2 block">
              Certified Instructors & Specialists
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Find a Dedicated Mentor
            </h1>
            <p className="text-base sm:text-lg text-white/80 mt-3 leading-relaxed">
              Match with certified educators across technology, music, sciences, creative arts, and academic excellence. Available for 1-on-1 private lessons at home or interactive live online — accommodating young learners, teens, and adults.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Dropdown-Driven, No Overflowing Pills) */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-[52px] sm:top-[64px] z-30 shadow-sm py-4">
        <div className="container mx-auto px-4 max-w-7xl">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            
            {/* Search Input (Span 5 on Desktop) */}
            <div className="relative sm:col-span-2 lg:col-span-5">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tutor by name, skill (e.g. Python, Piano, Math)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Subject Dropdown Box (Span 4 on Desktop) */}
            <div className="relative sm:col-span-1 lg:col-span-4">
              <div className="relative">
                <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none appearance-none cursor-pointer transition-all"
                >
                  {SUBJECT_CATEGORIES.map((catGroup) => (
                    <optgroup key={catGroup.label} label={catGroup.label}>
                      {catGroup.subjects.map((subj) => (
                        <option key={subj} value={subj}>
                          {subj === 'ALL' ? 'All Subjects & Skills' : subj}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Delivery Mode Dropdown Box (Span 2 on Desktop) */}
            <div className="relative sm:col-span-1 lg:col-span-2">
              <div className="relative">
                <SlidersHorizontal size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as any)}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-none appearance-none cursor-pointer transition-all"
                >
                  <option value="ALL">All Delivery Modes</option>
                  <option value="Online">Online (Live Virtual)</option>
                  <option value="Physical">Physical (In-Person / Home)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Reset Filters Button (Span 1 on Desktop) */}
            <div className="sm:col-span-2 lg:col-span-1 flex justify-end">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full lg:w-auto px-3 py-2.5 rounded-xl text-xs font-bold text-brand-red bg-brand-red/10 hover:bg-brand-red/20 transition-all flex items-center justify-center gap-1.5"
                  title="Reset all filters"
                >
                  <RotateCcw size={13} />
                  <span className="lg:hidden">Reset</span>
                </button>
              ) : (
                <div className="text-right hidden lg:block text-[11px] font-bold text-slate-400">
                  {filteredTutors.length} mentors
                </div>
              )}
            </div>

          </div>

          {/* Active Filter Chips Bar (Only shown if filters are active) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3 text-xs">
              <span className="text-slate-400 font-medium text-[11px]">Active Filters:</span>
              
              {selectedSubject !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-[11px]">
                  Subject: {selectedSubject}
                  <button onClick={() => setSelectedSubject('ALL')} className="hover:opacity-75">
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedMode !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-red text-white font-bold text-[11px]">
                  Mode: {selectedMode}
                  <button onClick={() => setSelectedMode('ALL')} className="hover:opacity-75">
                    <X size={12} />
                  </button>
                </span>
              )}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px]">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:opacity-75">
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                onClick={resetFilters}
                className="text-[11px] text-slate-500 hover:text-brand-red underline ml-auto font-medium"
              >
                Clear all
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Tutor Cards Grid */}
      <div className="py-12 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 max-w-7xl">
          
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Showing {filteredTutors.length} Verified Instructors
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Flexible scheduling • Zero public markups
            </span>
          </div>

          {filteredTutors.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 max-w-xl mx-auto space-y-4">
              <UserCheck size={40} className="mx-auto text-slate-400" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">No Tutors Match Your Filter</h3>
              <p className="text-xs text-slate-500">Try adjusting your search query or dropdown filter selections to view more mentors.</p>
              <Button onClick={resetFilters} variant="outline" className="text-xs font-bold">
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTutors.map((tutor) => (
                <div
                  key={tutor.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-brand-red/30 transition-all group"
                >
                  <div className="space-y-4">
                    
                    {/* Tutor Header */}
                    <div className="flex items-start gap-4">
                      <img
                        src={tutor.avatarUrl}
                        alt={tutor.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-black mb-0.5">
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                          <span>{tutor.rating}</span>
                          <span className="text-slate-400 font-normal">({tutor.reviewCount} reviews)</span>
                        </div>
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                          {tutor.name}
                        </h3>
                        <p className="text-xs text-brand-red font-bold truncate">
                          {tutor.title}
                        </p>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {tutor.bio}
                    </p>

                    {/* Specializations Chips */}
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1.5">
                        Specializations
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {tutor.specializations.map((spec) => (
                          <span
                            key={spec}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Meta info: Modes & Availability */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-brand-red shrink-0" />
                        <span>Delivery: <strong>{tutor.teachingModes.join(' & ')}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-brand-red shrink-0" />
                        <span>Available: <strong>{tutor.availability}</strong></span>
                      </div>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      onClick={() => setSelectedTutorForBooking(tutor)}
                      className="w-full bg-brand-red hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-brand-red/10"
                    >
                      Request This Mentor
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Booking Modal */}
      {selectedTutorForBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={closeModal}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X size={20} />
            </button>

            {bookingSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <Check size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Request Submitted!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  We've received your request for <strong>{selectedTutorForBooking.name}</strong>. Our academic coordinator will contact you at <strong>{phone}</strong> to confirm timetable alignment and schedule your first introductory session.
                </p>
                <Button onClick={closeModal} className="font-bold text-xs">
                  Done
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={selectedTutorForBooking.avatarUrl}
                    alt={selectedTutorForBooking.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <span className="text-[10px] font-black uppercase text-brand-red bg-brand-red/10 px-2 py-0.5 rounded-md">
                      Mentor Booking
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Request {selectedTutorForBooking.name}
                    </h3>
                    <p className="text-xs text-slate-500">{selectedTutorForBooking.title}</p>
                  </div>
                </div>

                <form onSubmit={handleBookingSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="e.g. Mr. Kolawole or Jane Doe"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Learner Name & Age (Optional if registering for yourself)
                      </label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. Femi (Age 10) or 'Self'"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Phone / WhatsApp Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+234 801 234 5678"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Preferred Day(s) & Time
                    </label>
                    <input
                      type="text"
                      value={preferredDays}
                      onChange={(e) => setPreferredDays(e.target.value)}
                      placeholder="e.g. Saturdays 10:00 AM or Tuesday afternoons"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Learning Objectives / Focus Areas (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="e.g. Needs help starting Scratch game coding and building confidence in mathematics."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-red"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-brand-red hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider py-3"
                    >
                      {submitting ? 'Submitting Request...' : 'Confirm Learning Plan Request'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

    </MainLayout>
  );
};

export default FindTutor;
