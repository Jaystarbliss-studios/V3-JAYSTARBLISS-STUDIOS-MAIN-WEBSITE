import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { 
  Loader2, Save, AlertCircle, CheckCircle2, 
  Radio, Mail, Send, Check, ShieldCheck, Sparkles 
} from 'lucide-react';

const AdminSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Resend Email Test State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [settings, setSettings] = useState({
    companyName: 'Jaystarbliss Studios',
    contactEmail: 'jaystarblissstudios@gmail.com',
    contactPhone: '+234 913 651 8194',
    secondaryPhone: '+234 913 052 9010',
    googleBusinessUrl: 'https://share.google/mqVU8pAgKEDjOfGHe',
    address: 'Lagos, Nigeria',
    heroHeading: 'LEARN. CREATE. INNOVATE.',
    heroSubheading: 'Empowering learners of all ages and building scalable modern tech solutions.',
    twitter: '',
    linkedin: '',
    instagram: '',
    cloudinaryCloudName: 'jaystarbliss',
    cloudinaryUploadPreset: 'jaystarbliss_cms',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: ''
  });

  // Banner State
  const [banner, setBanner] = useState({
    enabled: true,
    message: '⚡ Live System Notice: The website is currently undergoing active maintenance and progressive feature rollouts. Some modules, links, and resources may be dynamically updated in real-time. Thank you for learning and building with Jaystarbliss Studios!',
    badgeText: 'MAINTENANCE NOTICE',
    variant: 'maintenance',
    speed: 'normal',
    linkUrl: '/portal',
    linkLabel: 'Access Portal',
    showDismiss: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings(prev => ({ ...prev, ...data }));
        }

        // Fetch banner settings
        const bannerRef = doc(db, 'settings', 'banner');
        const bannerSnap = await getDoc(bannerRef);
        if (bannerSnap.exists()) {
          const bData = bannerSnap.data();
          setBanner(prev => ({ ...prev, ...bData }));
        }

        if (auth.currentUser?.email) {
          setTestEmailRecipient(auth.currentUser.email);
        }

        // Also check if cloudinary specific settings exist
        const cloudRef = doc(db, 'settings', 'cloudinary');
        const cloudSnap = await getDoc(cloudRef);
        if (cloudSnap.exists()) {
          const cData = cloudSnap.data();
          setSettings(prev => ({
            ...prev,
            cloudinaryCloudName: cData.cloudName || prev.cloudinaryCloudName,
            cloudinaryUploadPreset: cData.uploadPreset || prev.cloudinaryUploadPreset,
            cloudinaryApiKey: cData.apiKey || prev.cloudinaryApiKey,
            cloudinaryApiSecret: cData.apiSecret || prev.cloudinaryApiSecret
          }));
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setBanner(prev => ({ ...prev, [name]: checked }));
    } else {
      setBanner(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const user = auth.currentUser;
      const settingsRef = doc(db, 'settings', 'global');
      
      await setDoc(settingsRef, {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'unknown'
      }, { merge: true });

      // Save Banner configuration to settings/banner
      const bannerRef = doc(db, 'settings', 'banner');
      await setDoc(bannerRef, {
        ...banner,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'unknown'
      }, { merge: true });

      // Save Cloudinary configuration specifically
      const cloudinaryRef = doc(db, 'settings', 'cloudinary');
      await setDoc(cloudinaryRef, {
        cloudName: settings.cloudinaryCloudName || 'jaystarbliss',
        uploadPreset: settings.cloudinaryUploadPreset || 'jaystarbliss_cms',
        apiKey: settings.cloudinaryApiKey || '',
        apiSecret: settings.cloudinaryApiSecret || '',
        updatedAt: serverTimestamp()
      }, { merge: true });

      localStorage.setItem('cloudinary_cloud_name', settings.cloudinaryCloudName);
      localStorage.setItem('cloudinary_upload_preset', settings.cloudinaryUploadPreset);
      if (settings.cloudinaryApiKey) localStorage.setItem('cloudinary_api_key', settings.cloudinaryApiKey);
      
      setMessage({ type: 'success', text: 'Global settings and Sticky Marquee Banner saved successfully!' });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmailRecipient)) {
      setTestEmailResult({ success: false, message: 'Please enter a valid recipient email address for testing.' });
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/.netlify/functions/send-client-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'test_email',
          to: testEmailRecipient
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test email delivery failed.');
      setTestEmailResult({
        success: true,
        message: data.message || `Test email successfully dispatched to ${testEmailRecipient} via Resend!`
      });
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Unable to dispatch test email.'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-red" /></div>;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-brand-slate mb-8">Global Settings</h1>
      
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-8">
        
        {/* Sticky Maintenance & Announcement Marquee Banner Section */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 border border-slate-700 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Global Sticky Marquee Maintenance Banner</span>
                </h2>
                <p className="text-xs text-slate-400">Sticky viewport banner displayed across the website & portal</p>
              </div>
            </div>
            
            {/* Toggle ON/OFF */}
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                name="enabled"
                checked={banner.enabled}
                onChange={handleBannerChange}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              <span className="ml-3 text-sm font-bold text-white">
                {banner.enabled ? 'ACTIVE ON SITE' : 'DISABLED'}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Banner Announcement Text
              </label>
              <textarea
                name="message"
                value={banner.message}
                onChange={handleBannerChange}
                rows={3}
                placeholder="Enter formal or friendly maintenance announcement text..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Badge Label
                </label>
                <input
                  type="text"
                  name="badgeText"
                  value={banner.badgeText || ''}
                  onChange={handleBannerChange}
                  placeholder="e.g. MAINTENANCE NOTICE"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Visual Theme
                </label>
                <select
                  name="variant"
                  value={banner.variant || 'maintenance'}
                  onChange={handleBannerChange}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="maintenance">Dark Slate & Amber (Maintenance)</option>
                  <option value="warning">Bright Warning Amber</option>
                  <option value="crimson">Crimson Alert (Urgent)</option>
                  <option value="info">Ocean Blue (Update)</option>
                  <option value="emerald">Emerald Green (Feature Rollout)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Scroll Speed
                </label>
                <select
                  name="speed"
                  value={banner.speed || 'normal'}
                  onChange={handleBannerChange}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="slow">Slow (45s loop)</option>
                  <option value="normal">Normal (30s loop)</option>
                  <option value="fast">Fast (20s loop)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Action Button Link (Optional)
                </label>
                <input
                  type="text"
                  name="linkUrl"
                  value={banner.linkUrl || ''}
                  onChange={handleBannerChange}
                  placeholder="/portal or https://..."
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="mt-4 pt-3 border-t border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                Live Banner Preview:
              </span>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3 overflow-hidden text-xs text-amber-300">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px] uppercase border border-amber-500/30 shrink-0">
                  {banner.badgeText || 'NOTICE'}
                </span>
                <span className="truncate">{banner.message}</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Company Info */}
        <section>
          <h2 className="text-xl font-bold text-brand-slate border-b pb-2 mb-6">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name</label>
              <input
                type="text"
                name="companyName"
                value={settings.companyName}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Email</label>
              <input
                type="email"
                name="contactEmail"
                value={settings.contactEmail}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Primary Contact Phone</label>
              <input
                type="text"
                name="contactPhone"
                value={settings.contactPhone}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Secondary Contact Phone</label>
              <input
                type="text"
                name="secondaryPhone"
                value={settings.secondaryPhone}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Google Business Profile URL</label>
              <input
                type="text"
                name="googleBusinessUrl"
                value={settings.googleBusinessUrl}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Office Address</label>
              <input
                type="text"
                name="address"
                value={settings.address}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
          </div>
        </section>

        {/* Hero Content */}
        <section>
          <h2 className="text-xl font-bold text-brand-slate border-b pb-2 mb-6">Homepage Hero Content</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Main Heading</label>
              <input
                type="text"
                name="heroHeading"
                value={settings.heroHeading}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red font-bold text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Subheading</label>
              <textarea
                name="heroSubheading"
                value={settings.heroSubheading}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
          </div>
        </section>

        {/* Cloudinary Integration */}
        <section>
          <div className="flex items-center justify-between border-b pb-2 mb-6">
            <div>
              <h2 className="text-xl font-bold text-brand-slate dark:text-white">Cloudinary Image Storage & CDN</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure your Cloudinary credentials to upload and manage high-resolution images across all CMS pages.</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider bg-brand-red/10 text-brand-red px-2.5 py-1 rounded-full">
              Active Storage
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Cloudinary Cloud Name</label>
              <input
                type="text"
                name="cloudinaryCloudName"
                value={settings.cloudinaryCloudName}
                onChange={handleChange}
                placeholder="e.g. jaystarbliss"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red font-mono text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">Your Cloudinary account cloud name identifier.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Unsigned Upload Preset</label>
              <input
                type="text"
                name="cloudinaryUploadPreset"
                value={settings.cloudinaryUploadPreset}
                onChange={handleChange}
                placeholder="e.g. jaystarbliss_cms or ml_default"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red font-mono text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">Created in Cloudinary Settings &gt; Upload &gt; Upload Presets (set to Unsigned).</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Cloudinary API Key (Optional / Private)</label>
              <input
                type="text"
                name="cloudinaryApiKey"
                value={settings.cloudinaryApiKey}
                onChange={handleChange}
                placeholder="e.g. 123456789012345"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Cloudinary API Secret (Optional)</label>
              <input
                type="password"
                name="cloudinaryApiSecret"
                value={settings.cloudinaryApiSecret}
                onChange={handleChange}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red font-mono text-sm"
              />
            </div>
          </div>
        </section>

        {/* Resend Email Configuration & Client Communication Gateway */}
        <section className="bg-slate-900 text-white p-6 sm:p-7 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Resend Email Gateway & Client Communications</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE & CONFIGURED
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Transactional client communications, inquiry auto-responders, admissions confirmations & billing receipts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Resend API Integration</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Default Sender Identity</span>
              <div className="font-mono text-sm font-bold text-white bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 truncate">
                Jaystarbliss Studios &lt;onboarding@resend.dev&gt;
              </div>
              <p className="text-[11px] text-slate-400">
                All client emails, parent receipts, and partnership notices are dispatched through this verified sender.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Active Capabilities</span>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-400 shrink-0" />
                  <span>Website Contact & Inquiry Auto-Responders</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-400 shrink-0" />
                  <span>Student Tuition & Paystack Payment Receipts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-400 shrink-0" />
                  <span>School Partnership Portal Credentials & Approvals</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-400 shrink-0" />
                  <span>Direct Admin-to-Client Communications</span>
                </div>
              </div>
            </div>
          </div>

          {/* Test Email Dispatcher */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Sparkles size={16} className="text-amber-400" />
              <span>Send Live Test Email via Resend</span>
            </div>
            <p className="text-xs text-slate-400">
              Verify your Resend email deliverability by sending a test message to any email address.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter recipient email (e.g. your email)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail || !testEmailRecipient}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shrink-0 shadow-md shadow-rose-600/20"
              >
                {sendingTestEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sendingTestEmail ? 'Sending...' : 'Dispatch Test Email'}</span>
              </button>
            </div>

            {testEmailResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                testEmailResult.success 
                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
              }`}>
                {testEmailResult.success ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />}
                <div>
                  <p className="font-bold">{testEmailResult.success ? 'Delivery Success' : 'Delivery Notice'}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{testEmailResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Social Links */}
        <section>
          <h2 className="text-xl font-bold text-brand-slate border-b pb-2 mb-6">Social Media Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Twitter / X URL</label>
              <input
                type="url"
                name="twitter"
                value={settings.twitter}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">LinkedIn URL</label>
              <input
                type="url"
                name="linkedin"
                value={settings.linkedin}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Instagram URL</label>
              <input
                type="url"
                name="instagram"
                value={settings.instagram}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-6 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-brand-red text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
