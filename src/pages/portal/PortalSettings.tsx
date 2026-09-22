import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, User, Lock, Moon, Sun, 
  Mail, CheckCircle2, AlertCircle, RefreshCw,
  Bell, Save, Contrast, KeyRound, ShieldCheck
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { sendEmailVerification, updateProfile, updateEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import ChangePasswordModal from '../../components/portal/ChangePasswordModal';
import SEO from '../../components/ui/SEO';

const AVATAR_OPTIONS = [
  '🚀', '💻', '⚡', '🤖', '🎓', '🔥', '🌟', '🛡️', '🧠', '🔬'
];

type SettingsTab = 'profile' | 'appearance' | 'security' | 'notifications';

export const PortalSettings: React.FC = () => {
  const { theme, toggleTheme, isHighContrast, toggleHighContrast } = useTheme();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [role, setRole] = useState('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🚀');
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Appearance preferences
  const [compactMode, setCompactMode] = useState(false);
  const [smoothAnimations, setSmoothAnimations] = useState(true);

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
      const cleanEmail = email.trim();
      const schoolId = sessionStorage.getItem('schoolId') || (role === 'school' ? user?.uid : null);

      if (user) {
        if (fullName.trim()) {
          await updateProfile(user, { displayName: fullName.trim() });
          sessionStorage.setItem('userName', fullName.trim());
        }

        // Try updating auth email if changed
        if (cleanEmail && cleanEmail !== user.email) {
          try {
            await updateEmail(user, cleanEmail);
            toast.success(`Authentication login email updated to ${cleanEmail}`);
          } catch (authErr: any) {
            console.warn('Auth email update notice:', authErr);
            if (authErr.code === 'auth/requires-recent-login') {
              toast.info('Display & profile email updated in database. (Firebase Auth login change requires recent login)');
            }
          }
        }

        // Update User profile in Firestore
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            name: fullName.trim(),
            email: cleanEmail,
            phone: phone.trim(),
            avatar: selectedAvatar,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Non-fatal firestore user doc update:', err);
        }

        // If school admin, also sync the school document
        if (schoolId) {
          try {
            await updateDoc(doc(db, 'schools', schoolId), {
              contactEmail: cleanEmail,
              email: cleanEmail,
              contactName: fullName.trim(),
              phone: phone.trim(),
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            console.warn('Non-fatal firestore school doc update:', err);
          }
        }
      }

      toast.success('Account profile and preferences updated successfully!');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast.error('Failed to update profile settings: ' + (err.message || 'Please try again.'));
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
      toast.success(`Verification link dispatched to ${user.email}! Please check your inbox.`);
    } catch (err: any) {
      console.error('Verification email error:', err);
      if (err.code === 'auth/too-many-requests') {
        toast.error('Too many requests. Please wait a few moments.');
      } else {
        toast.error('Failed to send verification email. Please try again.');
      }
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <SEO 
        title="Account Preferences & Settings | Jaystarbliss Studios" 
        description="Manage your portal profile, theme appearance, passwords, and notification preferences." 
        noindex={true}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Account &amp; Preferences
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your personal profile, interface appearance, and account security.
          </p>
        </div>
      </div>

      {/* Sub-Navigation Pill Tabs (Matching Board 1 Screens 07-09) */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 dark:border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        {[
          { id: 'profile', label: 'Profile & Account', icon: User },
          { id: 'appearance', label: 'Appearance & Theme', icon: Sun },
          { id: 'security', label: 'Security & Password', icon: Lock },
          { id: 'notifications', label: 'Notifications', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-brand-red text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-brand-red/40'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Profile & Identity */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white dark:bg-[#161B26] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Profile Details</h2>
                <p className="text-xs text-slate-500">Your personal details and identifier on the platform.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-red/10 text-brand-red capitalize">
                {role}
              </span>
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Choose Cadet Avatar
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                      selectedAvatar === emoji
                        ? 'bg-brand-red/10 border-2 border-brand-red scale-105 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Full Display Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. David Johnson"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Contact / Institutional Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@school.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-red outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Displayed on your portal records and institutional reports.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Phone / WhatsApp Contact
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-red outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Portal Access / Identifier
                </label>
                <input
                  type="text"
                  disabled
                  value={sessionStorage.getItem('schoolCode') || sessionStorage.getItem('studentAccessCode') || auth.currentUser?.uid || 'JAYSTAR-ACC-01'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs cursor-text select-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <KeyRound size={13} className="text-brand-red" />
                <span>Change Account Password</span>
              </button>

              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Appearance & Theme (Matching Screen 08 & 15) */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-[#161B26] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Interface &amp; Visual Theme</h2>
            <p className="text-xs text-slate-500">Customize display mode, contrast balance, and layout responsiveness.</p>
          </div>

          {/* Theme Selector Segmented Row */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Color Theme Mode
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => { if (theme === 'dark') toggleTheme(); }}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  theme === 'light'
                    ? 'border-brand-red bg-brand-red/5 ring-1 ring-brand-red/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 shadow-xs">
                  <Sun size={16} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Light Mode</div>
                  <div className="text-[10px] text-slate-500">Crisp high daylight contrast</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { if (theme === 'light') toggleTheme(); }}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  theme === 'dark'
                    ? 'border-brand-red bg-brand-red/5 ring-1 ring-brand-red/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-white shadow-xs">
                  <Moon size={16} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Dark Mode</div>
                  <div className="text-[10px] text-slate-500">Eye-safe slate atmosphere</div>
                </div>
              </button>
            </div>
          </div>

          {/* Accessibility High Contrast */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">High Contrast Mode</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-red/10 text-brand-red">WCAG AAA</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Increases text density and sharpens element borders.</p>
            </div>

            <button
              id="btn-settings-high-contrast"
              type="button"
              onClick={() => {
                toggleHighContrast();
                toast.info(!isHighContrast ? 'High-contrast mode activated' : 'Standard contrast restored');
              }}
              className={`px-4 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-auto ${
                isHighContrast 
                  ? 'bg-brand-red text-white border-brand-red shadow-xs' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:border-brand-red'
              }`}
            >
              <Contrast size={14} className={isHighContrast ? 'text-white' : 'text-brand-red'} />
              <span>{isHighContrast ? 'High Contrast ON' : 'High Contrast OFF'}</span>
            </button>
          </div>

          {/* Compact Display Toggle */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white">Compact Data Density</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Tightens table rows and card padding for high-density overview.</p>
            </div>

            <button
              type="button"
              onClick={() => setCompactMode(!compactMode)}
              className={`px-4 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-auto ${
                compactMode 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>{compactMode ? 'Compact Enabled' : 'Standard Spacing'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Security & Credentials */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          {/* Email Verification Banner */}
          <div className={`p-5 rounded-2xl border ${
            emailVerified 
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200' 
              : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {emailVerified ? (
                  <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs">
                      {emailVerified ? 'Email Address Verified' : 'Email Address Unverified'}
                    </h3>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-black uppercase ${
                      emailVerified ? 'bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-200/60 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                    }`}>
                      {emailVerified ? 'Active' : 'Action Needed'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {emailVerified 
                      ? `Your account (${email}) is securely verified.`
                      : `Verify ${email} to ensure you receive class notices and recovery credentials.`}
                  </p>
                </div>
              </div>

              {!emailVerified && (
                <button
                  type="button"
                  onClick={handleSendVerificationEmail}
                  disabled={sendingVerification}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  {sendingVerification ? <RefreshCw size={12} className="animate-spin" /> : <Mail size={12} />}
                  <span>Resend Link</span>
                </button>
              )}
            </div>
          </div>

          {/* Password Management */}
          <div className="bg-white dark:bg-[#161B26] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Authentication &amp; Direct Password Change</h2>
              <p className="text-xs text-slate-500">Update your login password directly without needing to wait for an external reset email link.</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">Account Password</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Directly update and secure your portal credentials (minimum 8 characters).</p>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <KeyRound size={14} /> Change Password Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Notifications & Alerts */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-[#161B26] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Notification Broadcasts</h2>
            <p className="text-xs text-slate-500">Configure which messages trigger system alerts.</p>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Class Schedule Reminders</span>
                <span className="text-[11px] text-slate-500">Receive alerts 30 minutes before live class sessions.</span>
              </div>
              <input 
                type="checkbox" 
                checked={notifSchedules} 
                onChange={e => setNotifSchedules(e.target.checked)}
                className="w-4 h-4 text-brand-red rounded focus:ring-brand-red"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Institute Announcements</span>
                <span className="text-[11px] text-slate-500">Newsletters, hackathon announcements, and competitions.</span>
              </div>
              <input 
                type="checkbox" 
                checked={notifAnnouncements} 
                onChange={e => setNotifAnnouncements(e.target.checked)}
                className="w-4 h-4 text-brand-red rounded focus:ring-brand-red"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Tuition & Billing Statements</span>
                <span className="text-[11px] text-slate-500">Receipt confirmations and term renewal notices.</span>
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
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default PortalSettings;
