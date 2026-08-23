import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, 
  query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { 
  Bell, Send, Trash2, Clock
} from 'lucide-react';

const AdminNotifications: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form State
  const [recipientType, setRecipientType] = useState<string>('all');
  const [specificId, setSpecificId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // Dropdown lists
  const [staffList, setStaffList] = useState<any[]>([]);
  const [studentList, setStudentList] = useState<any[]>([]);

  // Sent notifications list
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotificationData = async () => {
    setLoading(true);
    try {
      // 1. Fetch staff
      const staffSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['staff', 'tutor', 'STAFF', 'TUTOR'])));
      setStaffList(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. Fetch students
      const studSnap = await getDocs(collection(db, 'individualStudents'));
      setStudentList(studSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3. Fetch notifications
      const notifSnap = await getDocs(query(collection(db, 'notifications'), orderBy('timestamp', 'desc'))).catch(() => getDocs(collection(db, 'notifications')));
      setNotifications(notifSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationData();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter a notification title and message.');
      return;
    }

    if ((recipientType === 'specific_staff' || recipientType === 'specific_student') && !specificId) {
      toast.error('Please select the specific recipient.');
      return;
    }

    setSending(true);
    const finalRecipientId = (recipientType === 'specific_staff' || recipientType === 'specific_student') 
      ? specificId 
      : recipientType;

    try {
      await addDoc(collection(db, 'notifications'), {
        recipientId: finalRecipientId,
        title: title.trim(),
        message: message.trim(),
        read: false,
        timestamp: serverTimestamp()
      });

      toast.success('Notification broadcast dispatched successfully!');
      setTitle('');
      setMessage('');
      setRecipientType('all');
      setSpecificId('');
      fetchNotificationData();
    } catch (err: any) {
      toast.error('Error dispatching notification: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!window.confirm('Delete this broadcast from history?')) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Notification removed.');
      fetchNotificationData();
    } catch (err: any) {
      toast.error('Failed to delete notification: ' + err.message);
    }
  };

  const getRecipientLabel = (id: string) => {
    if (id === 'all') return '🌐 Everyone (Universal)';
    if (id === 'all_staff') return '👨‍🏫 All Faculty & Staff';
    if (id === 'all_students') return '👥 All Students';

    const staffObj = staffList.find(s => s.id === id);
    if (staffObj) return `👨‍🏫 Staff: ${staffObj.name || staffObj.email}`;

    const studObj = studentList.find(s => s.id === id);
    if (studObj) return `👤 Student: ${studObj.fullName || studObj.username}`;

    return `ID: ${id}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-brand-slate dark:text-white flex items-center gap-3">
          <Bell className="text-brand-red w-8 h-8" />
          Broadcast &amp; Notification Central
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Transmit push banners and system announcements to students, parents, faculty, or targeted individuals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Broadcast Form */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-5">
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Send size={18} className="text-brand-red" />
            Create Broadcast Message
          </h2>

          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Send To *
              </label>
              <select
                value={recipientType}
                onChange={(e) => {
                  setRecipientType(e.target.value);
                  setSpecificId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
              >
                <option value="all">🌐 Everyone (All Users)</option>
                <option value="all_staff">👨‍🏫 All Faculty &amp; Staff Members</option>
                <option value="all_students">👥 All Students</option>
                <option value="specific_staff">📧 Specific Staff Member</option>
                <option value="specific_student">📧 Specific Student</option>
              </select>
            </div>

            {recipientType === 'specific_staff' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Staff Member *
                </label>
                <select
                  required
                  value={specificId}
                  onChange={(e) => setSpecificId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="">Choose staff member...</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.email} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {recipientType === 'specific_student' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Student *
                </label>
                <select
                  required
                  value={specificId}
                  onChange={(e) => setSpecificId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="">Choose student...</option>
                  {studentList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.username} (@{s.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Notification Headline *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Schedule Update: Coding Hackathon"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Broadcast Body *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement details..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-red"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {sending ? 'Dispatching...' : 'Transmit Broadcast'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">
            Sent Notifications &amp; History ({notifications.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-gray-400 font-mono text-xs">Loading broadcast logs...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-400 text-sm">
              No notifications sent yet.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-brand-red/10 text-brand-red">
                        {getRecipientLabel(n.recipientId)}
                      </span>
                      <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                        <Clock size={12} />
                        {n.timestamp?.toDate ? n.timestamp.toDate().toLocaleString() : 'Recent'}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-gray-900 dark:text-white leading-snug">
                      {n.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {n.message}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteNotification(n.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Delete Notification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;
