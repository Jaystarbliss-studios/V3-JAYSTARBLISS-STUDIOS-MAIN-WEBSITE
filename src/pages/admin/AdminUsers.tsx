import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Shield, User, Download, Plus, X, KeyRound, Copy, Check } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

const ROLE_OPTIONS = [
  ['USER', 'User (Default)'],
  ['STUDENT', 'Student'],
  ['PARENT', 'Parent'],
  ['TUTOR', 'Tutor'],
  ['STAFF', 'Staff'],
  ['SCHOOL', 'School Admin'],
  ['CONTENT_ADMIN', 'Content Admin'],
  ['EDUCATION_ADMIN', 'Education Admin'],
  ['SERVICES_ADMIN', 'Services Admin'],
  ['SUPER_ADMIN', 'Super Admin']
] as const;

const AdminUsers: React.FC = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('STUDENT');
  const [inviteName, setInviteName] = useState('');
  const [forcePasswordReset, setForcePasswordReset] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      setUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Unable to load user records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole.toLowerCase(), updatedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((user) => user.id === userId ? { ...user, role: newRole.toLowerCase() } : user));
      toast.success(`Role updated to ${newRole}.`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Role change was rejected.');
    }
  };

  const handleAccountStatus = async (userId: string, currentStatus: string | undefined) => {
    const nextStatus = String(currentStatus || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      if (!auth.currentUser) throw new Error('Your admin session has expired. Please sign in again.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/admin-account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, status: nextStatus })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to update account access securely.');
      setUsers((prev) => prev.map((user) => user.id === userId ? { ...user, accountStatus: nextStatus } : user));
      toast.success(nextStatus === 'ACTIVE' ? 'Account restored.' : 'Account suspended.');
    } catch (error) {
      console.error('Error updating account status:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update account access.');
    }
  };

  const handleToggleForcePasswordReset = async (userId: string, currentValue: boolean) => {
    const nextValue = !currentValue;
    try {
      await updateDoc(doc(db, 'users', userId), { forcePasswordReset: nextValue, updatedAt: new Date().toISOString() });
      setUsers((prev) => prev.map((user) => user.id === userId ? { ...user, forcePasswordReset: nextValue } : user));
      toast.success(nextValue ? 'Password reset required on next login.' : 'Password reset requirement cleared.');
    } catch (error) {
      console.error('Error toggling password reset:', error);
      toast.error('Unable to update password policy.');
    }
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!auth.currentUser) {
      toast.error('Your admin session has expired. Please sign in again.');
      return;
    }
    if (!cleanEmail || !inviteName.trim()) {
      toast.error('Enter the user name and email address.');
      return;
    }

    setInviting(true);
    setTemporaryPassword('');
    setCopied(false);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/admin-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: cleanEmail,
          role: inviteRole,
          forcePasswordReset
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to onboard this user.');

      const password = String(payload.temporaryPassword || '');
      setTemporaryPassword(password);
      await loadUsers();
      toast.success(`Firebase Auth account created for ${cleanEmail}.`);
      if (password) setShowInviteModal(true);
    } catch (error) {
      console.error('Admin onboarding error:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to onboard this user.');
    } finally {
      setInviting(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      toast.success('Temporary password copied.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Clipboard access is unavailable. Copy the password manually.');
    }
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteName('');
    setForcePasswordReset(true);
    setTemporaryPassword('');
    setCopied(false);
  };

  const exportToCSV = () => {
    if (users.length === 0) return;
    const headers = ['name', 'email', 'role', 'accountStatus', 'forcePasswordReset'];
    const csv = [
      headers.join(','),
      ...users.map((user) => headers.map((key) => `"${String(user[key] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'users_export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="invite-user-title">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-slate-800">
              <div>
                <h2 id="invite-user-title" className="text-lg font-black text-gray-900 dark:text-white">Onboard New User</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Creates the Firebase Auth account and matching role profile.</p>
              </div>
              <button type="button" onClick={closeInviteModal} className="min-h-11 min-w-11 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="Close onboarding dialog">
                <X size={20} className="mx-auto" />
              </button>
            </div>

            {temporaryPassword ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Account created successfully.</p>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">Give this temporary password to the user through a secure channel. It is not stored in Firestore.</p>
                </div>
                <div>
                  <label htmlFor="temporary-password" className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">Temporary Password</label>
                  <div className="flex gap-2">
                    <input id="temporary-password" readOnly value={temporaryPassword} className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 font-mono text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    <button type="button" onClick={copyTemporaryPassword} className="min-h-11 min-w-11 rounded-xl border border-gray-300 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200" aria-label="Copy temporary password">
                      {copied ? <Check size={18} className="mx-auto" /> : <Copy size={18} className="mx-auto" />}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={closeInviteModal} className="min-h-11 w-full rounded-xl bg-brand-red px-4 py-3 text-sm font-bold text-white">Done</button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label htmlFor="invite-name" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Full Name</label>
                  <input id="invite-name" required value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="e.g. Samuel Adewale" />
                </div>
                <div>
                  <label htmlFor="invite-email" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Email Address</label>
                  <input id="invite-email" required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="user@example.com" />
                </div>
                <div>
                  <label htmlFor="invite-role" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Assigned Role / Portal</label>
                  <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <input type="checkbox" checked={forcePasswordReset} onChange={(e) => setForcePasswordReset(e.target.checked)} className="mt-1 h-4 w-4" />
                  <span className="text-xs text-gray-700 dark:text-gray-300"><strong>Force password reset on first login.</strong><span className="mt-1 block text-gray-500 dark:text-gray-400">Recommended for temporary credentials.</span></span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeInviteModal} className="min-h-11 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 dark:border-slate-700 dark:text-gray-300">Cancel</button>
                  <button type="submit" disabled={inviting} className="min-h-11 flex-1 rounded-xl bg-brand-red px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{inviting ? 'Creating account…' : 'Create Account'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Users & Roles Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage dashboard access, role authorization, and password reset policies.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowInviteModal(true)} className="min-h-11 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white shadow-sm"><span className="inline-flex items-center gap-2"><Plus size={16} /> Onboard New User</span></button>
          <button onClick={exportToCSV} disabled={users.length === 0} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"><span className="inline-flex items-center gap-2"><Download size={16} /> Export CSV</span></button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-[900px] w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-gray-50 dark:bg-slate-950">
            <tr>
              {['User Profile', 'Account Type', 'Security State', 'Portal Role', 'Account Access'].map((heading) => <th key={heading} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{heading}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading user records…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No user records found.</td></tr>
            ) : users.map((user) => {
              const status = String(user.accountStatus || 'ACTIVE').toUpperCase();
              const role = String(user.role || 'user').toUpperCase();
              return (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-gray-500 dark:bg-slate-800">{role.includes('ADMIN') ? <Shield size={18} className="text-brand-red" /> : <User size={18} />}</div><div><div className="font-bold text-gray-900 dark:text-white">{user.name || user.displayName || 'Cadet / User'}</div><div className="text-xs text-gray-500 dark:text-gray-400">{user.email || 'No email'}</div></div></div></td>
                  <td className="px-5 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-gray-300">{role}</span></td>
                  <td className="px-5 py-4"><button onClick={() => handleToggleForcePasswordReset(user.id, user.forcePasswordReset === true)} className={`min-h-11 rounded-lg px-2.5 py-1 text-xs font-bold ${user.forcePasswordReset ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}><span className="inline-flex items-center gap-1.5"><KeyRound size={13} /> {user.forcePasswordReset ? 'Reset Required' : 'Password Active'}</span></button></td>
                  <td className="px-5 py-4"><select value={role} onChange={(e) => void handleRoleChange(user.id, e.target.value)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-white">{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                  <td className="px-5 py-4"><button onClick={() => void handleAccountStatus(user.id, status)} className={`min-h-11 rounded-lg border px-2.5 py-1 text-xs font-bold ${status === 'SUSPENDED' ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-emerald-200 bg-emerald-100 text-emerald-800'}`}>{status === 'SUSPENDED' ? 'Suspended — Restore' : 'Active — Suspend'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
