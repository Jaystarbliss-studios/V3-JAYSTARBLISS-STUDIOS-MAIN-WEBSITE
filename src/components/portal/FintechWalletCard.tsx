import React, { useState } from 'react';
import {
  Eye, EyeOff, ChevronRight, ArrowUpRight, ArrowDownLeft,
  Building2, ArrowDownToLine, HelpCircle, Bell, RefreshCw,
  Users, CheckCircle2, FileText
} from 'lucide-react';
import { formatCurrency, formatReceiptDate, parseDate } from '../../lib/receiptGenerator';
import type { TransactionReceiptData } from '../../lib/receiptGenerator';
import { FintechTransactionDetailsModal } from './FintechTransactionDetailsModal';

export interface FintechWalletCardProps {
  userName?: string;
  userRole?: 'staff' | 'admin' | 'superadmin' | 'school' | 'parent' | 'student';
  avatarUrl?: string;
  balance: number;
  currency?: string;
  subTitleText?: string;
  subTitleValue?: string;
  latestTransaction?: TransactionReceiptData | null;
  onViewTransactionHistory?: () => void;
  onAddMoney?: () => void;
  onWithdraw?: () => void;
  onTransferBank?: () => void;
  onTransferOPay?: () => void;
  onServiceClick?: (serviceId: string) => void;
  onHelpClick?: () => void;
  onScanClick?: () => void;
  onRefresh?: () => void;
  unreadNotificationsCount?: number;
  vaultTitle?: string;
  vaultDescription?: string;
  vaultRate?: string;
  onVaultClick?: () => void;
}

export const FintechWalletCard: React.FC<FintechWalletCardProps> = ({
  userRole = 'staff',
  balance,
  subTitleText = 'Teaching Roster',
  subTitleValue = '0 Students',
  latestTransaction,
  onViewTransactionHistory,
  onWithdraw,
  onServiceClick,
  onHelpClick,
  onRefresh,
  unreadNotificationsCount = 0,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const [selectedTx, setSelectedTx] = useState<TransactionReceiptData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const formattedBalance = formatCurrency(Number.isFinite(balance) ? balance : 0);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh?.();
    window.setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium capitalize">
            {userRole} Portal
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-black">
            ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshClick}
            className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
            title="Refresh wallet"
            aria-label="Refresh wallet"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
          </button>
          <button
            type="button"
            onClick={onHelpClick || (() => window.open('mailto:support@jaystarbliss.com', '_blank'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
            title="Help & Support"
          >
            <HelpCircle size={14} className="text-slate-500" />
            <span className="hidden sm:inline">Support</span>
          </button>
          <button
            type="button"
            onClick={onViewTransactionHistory}
            className="relative p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
            title="Transaction history"
            aria-label="Transaction history"
          >
            <Bell size={15} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-red text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl p-6 sm:p-8 space-y-6 transition-colors">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -top-12 w-56 h-56 rounded-full bg-sky-500/5 dark:bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={13} />
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {userRole === 'staff' ? 'Teaching Wallet Balance' : 'Available Account Balance'}
            </span>
            <button
              type="button"
              onClick={() => setShowBalance(value => !value)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title={showBalance ? 'Hide balance' : 'Show balance'}
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              type="button"
              onClick={handleRefreshClick}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title="Refresh balance"
              aria-label="Refresh balance"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
            </button>
          </div>
          <button
            type="button"
            onClick={onViewTransactionHistory}
            className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors group"
          >
            <span>Transaction History</span>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {showBalance ? formattedBalance : '₦••••••••'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              Live wallet balance from your account
            </p>
          </div>

          <button
            type="button"
            onClick={onWithdraw}
            className="min-h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowDownToLine size={15} strokeWidth={2.5} />
            <span>Withdraw Payout</span>
          </button>
        </div>

        <div className="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
              <Users size={14} className="text-sky-500 dark:text-sky-400" />
              <span>{subTitleText}</span>
            </div>
            <div className="font-mono font-black text-base text-slate-900 dark:text-white mt-1">
              {showBalance ? subTitleValue : '••••'}
            </div>
          </div>
        </div>
      </div>

      {latestTransaction && (
        <button
          type="button"
          onClick={() => setSelectedTx(latestTransaction)}
          className="w-full text-left rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 transition-all flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              String(latestTransaction.status || '').toLowerCase().includes('fail')
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
            }`}>
              {String(latestTransaction.type || '').toLowerCase().includes('withdraw') ? (
                <ArrowUpRight size={18} strokeWidth={2.5} />
              ) : (
                <ArrowDownLeft size={18} strokeWidth={2.5} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {latestTransaction.description || latestTransaction.plan || latestTransaction.paymentPlanName || 'Latest transaction'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {formatReceiptDate(parseDate(latestTransaction.paidAt || latestTransaction.createdAt))}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-mono text-xs font-black ${
              String(latestTransaction.type || '').toLowerCase().includes('withdraw')
                ? 'text-slate-900 dark:text-white'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {String(latestTransaction.type || '').toLowerCase().includes('withdraw') ? '-' : '+'}
              {formatCurrency(latestTransaction.customerTotal || latestTransaction.amount || 0)}
            </p>
            <span className="inline-block text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              {latestTransaction.status || 'Recorded'}
            </span>
          </div>
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={onViewTransactionHistory}
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-emerald-500/50 cursor-pointer transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText size={20} />
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">Ledger</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Payment Ledger &amp; Receipts</h3>
            <p className="text-[11px] text-slate-500 mt-1">View recorded wallet and payout transactions linked to your account.</p>
          </div>
          <div className="pt-1 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>View Full History</span><ChevronRight size={14} />
          </div>
        </div>

        <div
          onClick={onWithdraw}
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-sky-500/50 cursor-pointer transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 size={20} />
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">Bank payout</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Direct Bank Payout</h3>
            <p className="text-[11px] text-slate-500 mt-1">Send available wallet funds to your verified Nigerian bank account.</p>
          </div>
          <div className="pt-1 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400">
            <span>Withdraw</span><ChevronRight size={14} />
          </div>
        </div>

        <div
          onClick={() => onServiceClick?.('sessions')}
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-purple-500/50 cursor-pointer transition-all group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users size={20} />
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">Students</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Assigned Students &amp; Classes</h3>
            <p className="text-[11px] text-slate-500 mt-1">Check upcoming classes, assigned students, attendance and lesson schedules.</p>
          </div>
          <div className="pt-1 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
            <span>View Students</span><ChevronRight size={14} />
          </div>
        </div>
      </div>

      {selectedTx && (
        <FintechTransactionDetailsModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
};
