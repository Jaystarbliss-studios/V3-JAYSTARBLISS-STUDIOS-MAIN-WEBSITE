import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Video, MapPin, 
  ExternalLink,
  Users
} from 'lucide-react';
import SEO from '../../components/ui/SEO';

interface TimetableEvent {
  id: string;
  title: string;
  category: 'Class' | 'Exam' | 'Lab' | 'Workshop';
  day: string;
  time: string;
  instructor: string;
  roomOrLink: string;
  isOnline: boolean;
  color: string;
}

const EVENTS: TimetableEvent[] = [
  {
    id: 'ev-1',
    title: 'Web Dev Mastery: React & Responsive Components',
    category: 'Class',
    day: 'Monday',
    time: '4:00 PM – 5:30 PM WAT',
    instructor: 'Engr. John Rufai',
    roomOrLink: 'https://meet.google.com/jdh-web-live',
    isOnline: true,
    color: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  },
  {
    id: 'ev-2',
    title: 'Python AI & Machine Learning Logic Lab',
    category: 'Lab',
    day: 'Wednesday',
    time: '4:00 PM – 6:00 PM WAT',
    instructor: 'Lead AI Directorate',
    roomOrLink: 'https://meet.google.com/jdh-ai-lab',
    isOnline: true,
    color: 'border-brand-red bg-brand-red/10 text-brand-red dark:text-red-300'
  },
  {
    id: 'ev-3',
    title: 'Robotics Microcontroller & Hardware Circuit Workshop',
    category: 'Workshop',
    day: 'Thursday',
    time: '2:00 PM – 4:00 PM WAT',
    instructor: 'Engr. Rufai & STEM Faculty',
    roomOrLink: 'Innovation Smart Lab, Ikeja',
    isOnline: false,
    color: 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
  },
  {
    id: 'ev-4',
    title: 'Mid-Term CBT Evaluation & Code Submission',
    category: 'Exam',
    day: 'Friday',
    time: '3:00 PM – 4:30 PM WAT',
    instructor: 'Curriculum Council',
    roomOrLink: 'https://forms.google.com',
    isOnline: true,
    color: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  },
  {
    id: 'ev-5',
    title: 'Weekend Junior Scratch Coding & Animation Cohort',
    category: 'Class',
    day: 'Saturday',
    time: '10:00 AM – 12:00 PM WAT',
    instructor: 'STEM Faculty',
    roomOrLink: 'https://meet.google.com/jdh-kids-live',
    isOnline: true,
    color: 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300'
  }
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PortalCalendar: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filteredEvents = EVENTS.filter(ev => {
    const matchDay = selectedDay === 'All' || ev.day === selectedDay;
    const matchCat = filterCategory === 'ALL' || ev.category.toUpperCase() === filterCategory;
    return matchDay && matchCat;
  });

  return (
    <div className="space-y-6">
      <SEO 
        title="Class Calendar & Live Schedules | Jaystarbliss Studios" 
        description="View live classroom sessions, timetable schedules, exam dates, and practical lab hours." 
        noindex={true}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1">
            <CalendarIcon size={14} /> Interactive Timetable
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
            Classroom & Lab Schedules
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Synchronized weekly schedule for live coding classes, mentoring slots, and lab sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDay('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDay === 'All' 
                ? 'bg-brand-red text-white' 
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            All Week
          </button>
        </div>
      </div>

      {/* Day Selector Chips & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(selectedDay === day ? 'All' : day)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedDay === day
                  ? 'bg-brand-slate text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:border-brand-red'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-semibold shrink-0">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              filterCategory === 'ALL' ? 'bg-brand-slate text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterCategory('LIVE_CLASS')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              filterCategory === 'LIVE_CLASS' ? 'bg-brand-red text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Classes
          </button>
          <button
            onClick={() => setFilterCategory('LAB')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              filterCategory === 'LAB' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Labs
          </button>
          <button
            onClick={() => setFilterCategory('EXAM')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              filterCategory === 'EXAM' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Exams
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEvents.map(event => (
          <div 
            key={event.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-brand-red/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border ${event.color}`}>
                  {event.category}
                </span>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                  {event.day}
                </span>
              </div>

              <h3 className="font-bold text-base text-gray-900 dark:text-white mb-2 leading-snug">
                {event.title}
              </h3>

              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-4">
                <div className="flex items-center gap-2 text-brand-red font-medium">
                  <Clock size={13} /> {event.time}
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Users size={13} /> Instructor: <strong>{event.instructor}</strong>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  {event.isOnline ? <Video size={13} className="text-blue-500" /> : <MapPin size={13} className="text-amber-500" />}
                  <span>{event.isOnline ? 'Online Google Meet Live Room' : event.roomOrLink}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
              {event.isOnline ? (
                <a
                  href={event.roomOrLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  <Video size={14} /> Join Live Classroom <ExternalLink size={12} />
                </a>
              ) : (
                <div className="text-center text-xs font-bold text-gray-500 py-1.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl">
                  In-Person STEM Lab Session
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortalCalendar;
