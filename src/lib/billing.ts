import { auth } from './firebase';

export const billingGet = async <T>(path: string): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`/.netlify/functions/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to load billing information.');
  return data as T;
};

export const billingPost = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  const response = await fetch(`/.netlify/functions/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this billing operation.');
  return data as T;
};

export const formatNaira = (value: number | string | undefined | null) => {
  const amount = Number(value || 0);
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

export const asDate = (value: any): Date | null => {
  if (!value) return null;
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
};

export const dateLabel = (value: any) => asDate(value)?.toLocaleString('en-NG', {
  dateStyle: 'medium',
  timeStyle: 'short'
}) || '—';

export const feeFromBase = (base: number, policy: any) => {
  const amount = Math.max(0, Number(base) || 0);
  if (!policy?.enabled || amount <= 0) return { baseAmount: amount, transactionFee: 0, totalAmount: amount };
  const percentage = Math.max(0, Number(policy.percentage) || 0) / 100;
  const flat = amount < Number(policy.waiveFlatBelow || 0) ? 0 : Math.max(0, Number(policy.flat) || 0);
  const cap = Number(policy.cap) > 0 ? Number(policy.cap) : Number.POSITIVE_INFINITY;
  const raw = (amount * percentage) + flat;
  let total = raw > cap ? amount + cap : ((amount + flat) / Math.max(0.000001, 1 - percentage)) + 0.01;
  total = Math.ceil(total * 100) / 100;
  return { baseAmount: amount, transactionFee: Number((total - amount).toFixed(2)), totalAmount: total };
};
