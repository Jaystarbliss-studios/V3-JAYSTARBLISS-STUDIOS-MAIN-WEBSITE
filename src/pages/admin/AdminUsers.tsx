import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Shield, User, Download, Plus, X, KeyRound } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`Role successfully updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role. Ensure you have SUPER_ADMIN permissions.');
    }
  };

  const handleToggleForcePasswordReset = async (userId: string, currentVal: boolean) => {
    try {
      const nextVal = !currentVal;
      await updateDoc(doc(db, 'users', userId), {
        forcePasswordReset: nextVal,
        updatedAt: new Date().toISOString()
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, forcePasswordReset: nextVal } : u));
      toast.success(nextVal ? 'Password change will be required on next login.' : 'Password reset requirement cleared.');
    } catch (error) {
      console.error('Error toggling password reset requirement:', error);
      toast.error('Failed to update password reset setting.');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const cleanEmail = inviteEmail.trim().toLowerCase();
      // 1. Create invite entry
      await setDoc(doc(db, 'invites', cleanEmail), {
        email: cleanEmail,
        name: inviteName.trim(),
        role: inviteRole,
        forcePasswordReset: forcePasswordReset,
        createdAt: new Date().toISOString()
      });

      // 2. Also register in the target role-specific collection if applicable
      if (inviteRole === 'STUDENT') {
        const studentId = `std_${Date.now()}`;
        await setDoc(doc(db, 'individualStudents', studentId), {
          fullName: inviteName.trim() || 'New Student',
          email: cleanEmail,
          status: 'ACTIVE',
          forcePasswordReset: forcePasswordReset,
          plan: 'Standard Tech Track',
          createdAt: new Date().toISOString()
        });
      } else if (inviteRole === 'PARENT') {
        const parentId = `par_${Date.now()}`;
        await setDoc(doc(db, 'parents', parentId), {
          name: inviteName.trim() || 'Parent',
          email: cleanEmail,
          status: 'ACTIVE',
          forcePasswordReset: forcePasswordReset,
          createdAt: new Date().toISOString()
        });
      } else if (inviteRole === 'SCHOOL') {
        const schoolId = `sch_${Date.now()}`;
        await setDoc(doc(db, 'schools', schoolId), {
          name: inviteName.trim() || 'Partner School',
          email: cleanEmail,
          schoolCode: `SCH-${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'ACTIVE',
          forcePasswordReset: forcePasswordReset,
          createdAt: new Date().toISOString()
        });
      } else if (inviteRole === 'TUTOR' || inviteRole === 'STAFF') {
        const tutorId = `tut_${Date.now()}`;
        await setDoc(doc(db, 'tutors', tutorId), {
          name: inviteName.trim() || 'Tutor',
          email: cleanEmail,
          role: inviteRole,
          status: 'ACTIVE',
          forcePasswordReset: forcePasswordReset,
          createdAt: new Date().toISOString()
        });
      }

      toast.success(`User ${cleanEmail} onboarded! ${forcePasswordReset ? 'They will be prompted to change their password on first login.' : ''}`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setForcePasswordReset(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to onboard user. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const exportToCSV = () => {
    if (users.length === 0) return;
    const headers = Object.keys(users[0]).filter(k => typeof users[0][k] !== 'object');
    const csvContent = [
      headers.join(','),
      ...users.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Onboard New User</h2>
                <p className="text-xs text-gray-500">Create access for portal accounts</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={inviteName} 
                  onChange={e => setInviteName(e.target.value)} 
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red" 
                  placeholder="e.g. Samuel Adewale"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red" 
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">Assigned Role / Portal</label>
                <select 
                  value={inviteRole} 
                  onChange={e => setInviteRole(e.target.value)} 
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  <option value="STUDENT">Individual Student (Student Portal)</option>
                  <option value="PARENT">Parent / Guardian (Parent Portal)</option>
                  <option value="TUTOR">Tutor / Instructor (Staff Portal)</option>
                  <option value="STAFF">Institute Staff (Staff Portal)</option>
                  <option value="SCHOOL">School Admin (School Portal)</option>
                  <option value="USER">General User (Default)</option>
                  <option value="CONTENT_ADMIN">Content Admin (Admin Panel)</option>
                  <option value="EDUCATION_ADMIN">Education Admin (Admin Panel)</option>
                  <option value="SERVICES_ADMIN">Services Admin (Admin Panel)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                </select>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 flex items-start gap-3">
                <input 
                  type="checkbox"
                  id="forceResetCheckbox"
                  checked={forcePasswordReset}
                  onChange={e => setForcePasswordReset(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-brand-red focus:ring-brand-red border-gray-300"
                />
                <label htmlFor="forceResetCheckbox" className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                  <strong>Force password reset upon sign in</strong>
                  <span className="block text-gray-500 text-[11px] mt-0.5">
                    User will be prompted immediately to set a secure private password when accessing their dashboard.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={inviting}
                  className="flex-1 bg-brand-red hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 transition-colors shadow-sm"
                >
                  {inviting ? 'Onboarding...' : 'Onboard User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Users & Roles Management</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage dashboard access, role authorizations, and password reset policies.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 bg-brand-red text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Onboard New User
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-gray-50 dark:bg-slate-950">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User Profile</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account Type</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Security State</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Portal Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-sm">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">Loading user records...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">No user records found.</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 shrink-0">
                        {user.role?.includes('ADMIN') ? <Shield size={18} className="text-brand-red" /> : <User size={18} />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{user.name || user.displayName || 'Cadet / User'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                      {user.accountType || user.role || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleForcePasswordReset(user.id, user.forcePasswordReset === true)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        user.forcePasswordReset
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200'
                          : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 hover:bg-green-200'
                      }`}
                      title="Click to toggle required password change"
                    >
                      <KeyRound size={13} />
                      <span>{user.forcePasswordReset ? 'Reset Required' : 'Password Active'}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role || 'USER'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="text-xs font-semibold border border-gray-200 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-red"
                    >
                      <option value="USER">User (Default)</option>
                      <option value="STUDENT">Student</option>
                      <option value="PARENT">Parent</option>
                      <option value="TUTOR">Tutor</option>
                      <option value="STAFF">Staff</option>
                      <option value="SCHOOL">School Admin</option>
                      <option value="CONTENT_ADMIN">Content Admin</option>
                      <option value="EDUCATION_ADMIN">Education Admin</option>
                      <option value="SERVICES_ADMIN">Services Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
