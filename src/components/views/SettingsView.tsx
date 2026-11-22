import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import type { UserProfile } from '../../types/finance.ts';
import { formatINR } from '../../services/financeEngine.ts';

interface SettingsViewProps {
  user: UserProfile;
  onSaveSettings: (payload: Partial<UserProfile>) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export function SettingsView({ user, onSaveSettings, onResetDemo }: SettingsViewProps) {
  const [name, setName] = useState(user.name);
  const [businessName, setBusinessName] = useState(user.businessName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [upiId, setUpiId] = useState(user.upiId);
  const [openingCashBalance, setOpeningCashBalance] = useState(user.openingCashBalance);
  const [safetyBufferAmount, setSafetyBufferAmount] = useState(user.safetyBufferAmount);
  const [collectionAssumptionPercent, setCollectionAssumptionPercent] = useState(
    user.collectionAssumptionPercent
  );
  const [includeRecurring, setIncludeRecurring] = useState(
    user.includeRecurringTuitionInForecast
  );
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        name,
        businessName,
        email,
        phone,
        upiId,
        openingCashBalance: Number(openingCashBalance) || 0,
        safetyBufferAmount: Number(safetyBufferAmount) || 0,
        collectionAssumptionPercent: Number(collectionAssumptionPercent) || 100,
        includeRecurringTuitionInForecast: includeRecurring,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
          Settings
        </h1>
        <p className="text-sm text-[#717789] mt-0.5">
          Configure your studio profile, UPI ID, opening cash balance, and forecast preferences.
        </p>
      </div>

      {/* Brand Identity Card */}
      <div className="fintech-card p-5 flex items-center gap-4 bg-gradient-to-r from-[#F0ECFF]/60 to-white">
        <div className="w-11 h-11 rounded-xl bg-[#7257E8] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(114,87,232,0.25)]">
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M12 7v11" />
            <path d="M8 14l4 4 7-7" />
          </svg>
        </div>
        <div>
          <div className="font-display font-bold text-sm text-[#171923]">
            TutorFlow AI — <span className="text-[#7257E8]">Teach Better. Manage Smarter.</span>
          </div>
          <p className="text-xs text-[#717789] mt-0.5">
            Your entire tutoring business, under control. Manage fees, track payments, and predict your cash flow with AI.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="fintech-card p-6 space-y-5">
        <div className="border-b border-[#EAECF2] pb-4">
          <h2 className="font-display font-semibold text-base text-[#171923]">
            Tutor Studio &amp; Cash Settings
          </h2>
          <p className="text-xs text-[#717789] mt-0.5">
            Changes update your invoice headers, reminders, and cash flow forecast baseline immediately.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Tutor Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Business / Studio Name
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              UPI ID (invoices &amp; reminders)
            </label>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm font-mono text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Available Cash Balance (₹)
            </label>
            <input
              type="number"
              value={openingCashBalance}
              onChange={(e) => setOpeningCashBalance(Number(e.target.value))}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Target Safety Buffer (₹)
            </label>
            <input
              type="number"
              min={0}
              value={safetyBufferAmount}
              onChange={(e) => setSafetyBufferAmount(Number(e.target.value))}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#717789] font-medium">
              Default Collection Assumption for Unpaid Fees
            </span>
            <span className="font-mono font-bold text-[#7257E8]">
              {collectionAssumptionPercent}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={collectionAssumptionPercent}
            onChange={(e) => setCollectionAssumptionPercent(Number(e.target.value))}
            className="w-full accent-[#7257E8]"
          />
          <label className="inline-flex items-center gap-2 text-xs text-[#171923] cursor-pointer">
            <input
              type="checkbox"
              checked={includeRecurring}
              onChange={(e) => setIncludeRecurring(e.target.checked)}
              className="accent-[#7257E8]"
            />
            Include projected monthly recurring tuition in 30/60/90-day forecasts
          </label>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Demo Data Management */}
      <div className="fintech-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-sm text-[#171923]">
            Sample Demo Dataset
          </h3>
          <p className="text-xs text-[#717789] mt-1">
            Preloaded with 12 students, overdue &amp; partial invoices, recurring expenses, and{' '}
            {formatINR(10500)} starting cash. Reset anytime to restore the original demo state.
          </p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-2 rounded-[9px] text-xs font-medium text-[#717789] hover:text-[#171923]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await onResetDemo();
                setConfirmReset(false);
              }}
              className="px-3.5 py-2 rounded-[9px] text-xs font-semibold bg-[#E35454] text-white hover:bg-[#C94343]"
            >
              Confirm Reset
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#F7F8FC] text-[#171923] border border-[#EAECF2] hover:border-[#E35454] hover:text-[#E35454] transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        )}
      </div>
    </div>
  );
}
