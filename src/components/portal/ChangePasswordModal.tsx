import React, { useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isForced?: boolean;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  isForced = false,
  onSuccess
}) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const calculateStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = calculateStrength(newPassword);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No active user session. Please sign in again.');
      }

      await updatePassword(user, newPassword);

      // Update forcePasswordReset flag in Firestore if applicable
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userDocRef, {
          forcePasswordReset: false,
          passwordUpdatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Could not update user doc flag (non-fatal):', err);
      }

      sessionStorage.setItem('forcePasswordReset', 'false');
      setSuccess(true);
      toast.success('Your password has been successfully updated!');

      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Password update error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security reasons, please log out and log in again before changing your password.');
      } else {
        setError(err.message || 'Failed to update password. Please try again.');
      }
      toast.error('Failed to change password. Please check requirements.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        
        {!isForced && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center border border-brand-red/20 shrink-0">
            <Lock size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              {isForced ? 'Action Required: Set New Password' : 'Change Password'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isForced 
                ? 'Your account was initialized with temporary credentials. Please choose a new secure password to proceed.' 
                : 'Enter a strong, memorable password to secure your account.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 size={48} className="mx-auto text-green-500 animate-bounce" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Password Updated!</h3>
            <p className="text-xs text-gray-500">Your new credentials have been secured.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full transition-colors ${
                          idx < strength ? strengthColors[strength - 1] : 'bg-gray-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 text-right font-medium">
                    Strength: {strengthLabels[strength - 1] || 'Too short'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              {!isForced && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-brand-red/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>{isForced ? 'Set Password & Enter Portal' : 'Save New Password'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default ChangePasswordModal;
