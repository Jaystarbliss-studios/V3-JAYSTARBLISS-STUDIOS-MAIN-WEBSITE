import React, { useState, useEffect } from 'react';
import { 
  Building2, Smartphone, ArrowDownToLine, X, 
  CheckCircle2, ShieldCheck, 
  ArrowRight, Loader2
} from 'lucide-react';
import { formatCurrency } from '../../lib/receiptGenerator';
import { useToast } from '../../contexts/ToastContext';

export interface BankOption {
  code: string;
  name: string;
}

const DEFAULT_NIGERIAN_BANKS: BankOption[] = [
  { code: '999992', name: 'OPay Digital Services' },
  { code: '999991', name: 'PalmPay Limited' },
  { code: '50211', name: 'Kuda Microfinance Bank' },
  { code: '50515', name: 'Moniepoint Microfinance Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '044', name: 'Access Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '035', name: 'Wema Bank / ALAT' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '101', name: 'Providus Bank' }
];

export interface FintechWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  initialMode?: 'bank' | 'opay';
  savedBankCode?: string;
  savedAccountNumber?: string;
  savedAccountName?: string;
  banksList?: BankOption[];
  onConfirmWithdrawal: (data: {
    destination: 'bank' | 'opay';
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    fee: number;
    netAmount: number;
  }) => Promise<void>;
}

export const FintechWithdrawalModal: React.FC<FintechWithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance = 0,
  initialMode = 'bank',
  savedBankCode = '',
  savedAccountNumber = '',
  savedAccountName = '',
  banksList,
  onConfirmWithdrawal
}) => {
  const { toast } = useToast();
  const [destination, setDestination] = useState<'bank' | 'opay'>(initialMode);
  const [bankCode, setBankCode] = useState(savedBankCode || '058');
  const [accountNumber, setAccountNumber] = useState(savedAccountNumber);
  const [accountName, setAccountName] = useState(savedAccountName);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [submitting, setSubmitting] = useState(false);

  const availableBanks = banksList && banksList.length > 0 ? banksList : DEFAULT_NIGERIAN_BANKS;

  useEffect(() => {
    if (initialMode) setDestination(initialMode);
    if (initialMode === 'opay') {
      setBankCode('999992');
    }
  }, [initialMode]);

  // Simulated account name verification when 10 digits entered
  useEffect(() => {
    if (accountNumber.length === 10) {
      setVerifyingAccount(true);
      const timer = setTimeout(() => {
        const derivedName = savedAccountName || 'JOHN RUFAI (VERIFIED)';
        setAccountName(derivedName);
        setVerifyingAccount(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      if (!savedAccountName) setAccountName('');
    }
  }, [accountNumber, bankCode, savedAccountName, availableBanks]);

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  // Calculate standard ₦100 flat fee or 0%
  const fee = numAmount > 0 ? (numAmount > 50000 ? 100 : 50) : 0;
  const netAmount = Math.max(0, numAmount - fee);
  const selectedBank = availableBanks.find(b => b.code === bankCode) || availableBanks[0];

  const handlePreset = (val: number) => {
    if (val > availableBalance) {
      toast.info('Preset exceeds your current available balance.');
    }
    setAmount(String(Math.min(val, availableBalance)));
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount < 1000) {
      toast.error('Minimum withdrawal amount is ₦1,000');
      return;
    }
    if (numAmount > availableBalance) {
      toast.error('Withdrawal amount exceeds your available balance');
      return;
    }
    if (accountNumber.length < 10) {
      toast.error('Please enter a valid 10-digit NUBAN account number');
      return;
    }
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    if (pin.length < 4) {
      toast.error('Please enter your 4-digit transaction PIN (e.g. 1234)');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirmWithdrawal({
        destination,
        bankCode,
        bankName: destination === 'opay' ? 'OPay Digital Services' : selectedBank.name,
        accountNumber,
        accountName: accountName || 'Verified Recipient',
        amount: numAmount,
        fee,
        netAmount
      });
      toast.success(`Withdrawal of ${formatCurrency(numAmount)} initiated successfully!`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to complete payout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
      <div 
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center">
              <ArrowDownToLine size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {step === 'form' ? 'Withdraw / Transfer' : 'Confirm Payout Transfer'}
              </h2>
              <p className="text-xs text-slate-500">
                Available Balance: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(availableBalance)}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleContinue} className="mt-5 space-y-4">
            {/* Destination Toggle (To Bank vs To OPay) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => { setDestination('bank'); setBankCode(savedBankCode || '058'); }}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                  destination === 'bank'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 size={15} />
                <span>To Bank</span>
              </button>

              <button
                type="button"
                onClick={() => { setDestination('opay'); setBankCode('999992'); }}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                  destination === 'opay'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone size={15} />
                <span>To OPay / MoMo</span>
              </button>
            </div>

            {/* Destination Bank / Channel Selection */}
            {destination === 'bank' && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Destination Bank
                </label>
                <select
                  value={bankCode}
                  onChange={e => setBankCode(e.target.value)}
                  className="w-full min-h-12 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-hidden"
                >
                  {availableBanks.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Account Number */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  {destination === 'opay' ? 'OPay / Wallet Phone Number (10 Digits)' : 'NUBAN Account Number (10 Digits)'}
                </label>
                {verifyingAccount && (
                  <span className="text-[10px] text-brand-red flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Verifying…
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={10}
                required
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 0123456789"
                className="w-full min-h-12 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm font-black text-slate-900 dark:text-white tracking-widest focus:ring-2 focus:ring-brand-red outline-hidden"
              />

              {accountName && (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  <span className="font-bold truncate">Verified Name: {accountName}</span>
                </div>
              )}
            </div>

            {/* Withdrawal Amount */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Withdrawal Amount (₦ NGN)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black font-mono text-slate-400">
                  ₦
                </span>
                <input
                  type="number"
                  min="1000"
                  max={availableBalance}
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-12 pl-8 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-base font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-red outline-hidden"
                />
              </div>

              {/* Quick Amount Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[5000, 10000, 20000, 50000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handlePreset(val)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                  >
                    ₦{val.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount(String(availableBalance))}
                  className="px-2.5 py-1 rounded-xl bg-brand-red/10 hover:bg-brand-red/20 text-[11px] font-black text-brand-red"
                >
                  All (Max)
                </button>
              </div>
            </div>

            {/* Fee Breakdown */}
            {numAmount > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Gross Amount</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(numAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Transfer Service Fee</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(fee)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold">
                  <span className="text-slate-900 dark:text-white font-black">Net Payout to Account</span>
                  <span className="font-mono text-sm font-black text-brand-red">{formatCurrency(netAmount)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={numAmount <= 0 || numAmount > availableBalance || accountNumber.length < 10}
              className="w-full min-h-12 rounded-2xl bg-brand-red hover:bg-red-700 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-4"
            >
              <span>Review Withdrawal</span>
              <ArrowRight size={15} />
            </button>
          </form>
        ) : (
          /* STEP 2: CONFIRMATION & PIN STEP */
          <div className="mt-5 space-y-5">
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-1">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider">
                Payout Amount
              </span>
              <p className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                {formatCurrency(netAmount)}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Instant Settlement to {destination === 'opay' ? 'OPay Wallet' : selectedBank.name}
              </p>
            </div>

            {/* Summary Details */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">Destination Bank</span>
                <strong className="text-slate-900 dark:text-white">{destination === 'opay' ? 'OPay Digital Services' : selectedBank.name}</strong>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">Account Number</span>
                <strong className="font-mono text-slate-900 dark:text-white">{accountNumber}</strong>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">Beneficiary Name</span>
                <strong className="text-slate-900 dark:text-white">{accountName || 'Verified Instructor'}</strong>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">Gateway Service Fee</span>
                <strong className="font-mono text-slate-900 dark:text-white">{formatCurrency(fee)}</strong>
              </div>
            </div>

            {/* 4-Digit PIN */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 text-center mb-2">
                Enter 4-Digit Security PIN to Authorize
              </label>
              <div className="flex justify-center gap-3">
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-40 min-h-12 text-center rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-2xl tracking-[0.5em] font-black text-slate-900 dark:text-white focus:border-brand-red outline-hidden"
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1.5">
                Default demo security PIN: <span className="font-mono font-bold">1234</span>
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex-1 min-h-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Back
              </button>

              <button
                type="button"
                disabled={submitting || pin.length < 4}
                onClick={handleFinalSubmit}
                className="flex-2 min-h-12 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Payout…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Authorize & Withdraw</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
