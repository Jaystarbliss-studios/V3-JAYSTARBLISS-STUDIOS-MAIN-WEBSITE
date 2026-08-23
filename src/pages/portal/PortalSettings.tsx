import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, User, Lock, Moon, Sun, 
  Mail, CheckCircle2, AlertCircle, RefreshCw,
  Bell, Save, Sparkles, Contrast
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import ChangePasswordModal from '../../components/portal/ChangePasswordModal';
import SEO from '../../components/ui/SEO';

const AVATAR_OPTIONS = [
  '🚀', '💻', '⚡', '🤖', '🎓', '🔥', '🌟', '🛡️', '🧠', '🔬'
];

export const PortalSettings: React.FC = () => {
  const { theme, toggleTheme, isHighContrast, toggleHighContrast } = useTheme();
  const { toast } = useToast();
  
  const [role, setRole] = useState('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🚀');
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Notification Preferences
  const [notifSchedules, setNotifSchedules] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);
  const [notifBilling, setNotifBilling] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    const userRole = sessionStorage.getItem('userRole') || 'student';
    setRole(userRole);

    if (user) {
      setEmail(user.email || '');
      setEmailVerified(user.emailVerified);
      setFullName(user.displayName || sessionStorage.getItem('userName') || '');
    }

    const loadUserDoc = async () => {
      if (!user) return;
      try {
        const uDoc = await getDoc(doc(db, 'users', user.uid));
        if (uDoc.exists()) {
          const d = uDoc.data();
          if (d.name) setFullName(d.name);
          if (d.phone) setPhone(d.phone);
          if (d.avatar) setSelectedAvatar(d.avatar);
        }
      } catch (err) {
        console.warn('Could not load user doc settings:', err);
      }
    };

    loadUserDoc();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updateProfile(user, { displayName: fullName });
        sessionStorage.setItem('userName', fullName);

        try {
          await updateDoc(doc(db, 'users', user.uid), {
            name: fullName,
            phone: phone,
            avatar: selectedAvatar,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Non-fatal firestore update:', err);
        }
      }

      toast.success('Profile preferences successfully updated!');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to update profile settings.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSendingVerification(true);
    try {
      await sendEmailVerification(user);
      toast.success(`Verification link dispatched to ${user.email}! Please check your inbox or spam folder.`);
    } catch (err: any) {
      console.error('Verification email error:', err);
      if (err.code === 'auth/too-many-requests') {
        toast.error('Too many requests. Please wait a few moments before requesting another link.');
      } else {
        toast.error('Failed to send verification email. Please try again.');
      }
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <SEO 
        title="Account Preferences & Security Settings | Jaystarbliss Studios" 
        description="Manage your portal profile, email verification, passwords, and preferences." 
        noindex={true}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider mb-1">
            <SettingsIcon size={14} /> Portal Settings
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
            Account & Security Settings
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Personalize your portal identity, update access credentials, and adjust alert notifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPasswordModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
        >
          <Lock size={14} /> Change Password
        </button>
      </div>

      {/* Email Verification Status Card */}
      <div className={`p-6 rounded-3xl border ${
        emailVerified 
          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50 text-green-900 dark:text-green-200' 
          : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {emailVerified ? (
              <CheckCircle2 size={24} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={24} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  {emailVerified ? 'Official Email Address Verified' : 'Email Address Unverified'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  emailVerified ? 'bg-green-200/60 text-green-800 dark:bg-green-900/60 dark:text-green-300' : 'bg-amber-200/60 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                }`}>
                  {emailVerified ? 'Active & Confirmed' : 'Action Recommended'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {emailVerified 
                  ? `Your account (${email}) has completed Firebase two-step verification.`
                  : `Verify ${email} to ensure you receive class notices, grade reports, and reset recovery instructions.`}
              </p>
            </div>
          </div>

          {!emailVerified && (
            <button
              type="button"
              onClick={handleSendVerificationEmail}
              disabled={sendingVerification}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
            >
              {sendingVerification ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Sending Link...</span>
                </>
              ) : (
                <>
                  <Mail size={13} />
                  <span>Resend Verification Email</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <User size={20} className="text-brand-red" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profile Details</h2>
          </div>

          {/* Avatar Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Choose Cadet Avatar
            </label>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition-all ${
                    selectedAvatar === emoji
                      ? 'bg-brand-red/10 border-2 border-brand-red scale-110 shadow-xs'
                      : 'bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:scale-105'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                Full Display Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. David Johnson"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-red outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                Registered Email Address
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800/50 text-gray-500 text-xs cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                Phone / WhatsApp Contact
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-red outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                Assigned Portal Role
              </label>
              <input
                type="text"
                disabled
                value={role.toUpperCase()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800/50 text-gray-500 font-bold text-xs capitalize cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Appearance & Interface */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <Sparkles size={20} className="text-brand-red" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Interface & Theme Preferences</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Theme Display Mode</h4>
              <p className="text-xs text-gray-500">Toggle between daylight mode and eye-comfort dark mode.</p>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 hover:border-brand-red transition-colors self-start sm:self-auto"
            >
              {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-700" />}
              <span>{theme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active'}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">High Contrast Accessibility Mode</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-red/10 text-brand-red">WCAG AAA</span>
              </div>
              <p className="text-xs text-gray-500">Increases text density, sharpens element borders, and maximizes readability across all learning screens.</p>
            </div>

            <button
              id="btn-settings-high-contrast"
              type="button"
              onClick={() => {
                toggleHighContrast();
                toast.info(!isHighContrast ? 'High-contrast mode activated' : 'Standard contrast restored');
              }}
              className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-auto ${
                isHighContrast 
                  ? 'bg-brand-red text-white border-brand-red shadow-xs' 
                  : 'bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white border-gray-200 dark:border-slate-700 hover:border-brand-red'
              }`}
            >
              <Contrast size={15} className={isHighContrast ? 'text-white' : 'text-brand-red'} />
              <span>{isHighContrast ? 'High Contrast ON' : 'High Contrast OFF'}</span>
            </button>
          </div>
        </div>

        {/* Notifications Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
            <Bell size={20} className="text-brand-red" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notification Broadcasts</h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50/60 dark:bg-slate-800/50 cursor-pointer">
              <div>
                <span className="font-bold text-gray-900 dark:text-white block">Class Schedule Reminders</span>
                <span className="text-gray-500">Receive alerts 30 minutes before live online classes.</span>
              </div>
              <input 
                type="checkbox" 
                checked={notifSchedules} 
                onChange={e => setNotifSchedules(e.target.checked)}
                className="w-4 h-4 text-brand-red rounded focus:ring-brand-red"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50/60 dark:bg-slate-800/50 cursor-pointer">
              <div>
                <span className="font-bold text-gray-900 dark:text-white block">Institute Announcements</span>
                <span className="text-gray-500">Newsletters, hackathon announcements, and competitions.</span>
              </div>
              <input 
                type="checkbox" 
                checked={notifAnnouncements} 
                onChange={e => setNotifAnnouncements(e.target.checked)}
                className="w-4 h-4 text-brand-red rounded focus:ring-brand-red"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50/60 dark:bg-slate-800/50 cursor-pointer">
              <div>
                <span className="font-bold text-gray-900 dark:text-white block">Tuition & Billing Statements</span>
                <span className="text-gray-500">Receipt confirmations and term renewal reminders.</span>
              </div>
              <input 
                type="checkbox" 
                checked={notifBilling} 
                onChange={e => setNotifBilling(e.target.checked)}
                className="w-4 h-4 text-brand-red rounded focus:ring-brand-red"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-3 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            {savingProfile ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default PortalSettings;
