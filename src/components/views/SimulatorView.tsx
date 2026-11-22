import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import type { AppDatabase } from '../../types/finance.ts';
import {
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
  getTodayISO,
  simulateWhatIfScenario,
} from '../../services/financeEngine.ts';
import { addDaysISO } from '../../services/seedData.ts';

interface SimulatorViewProps {
  db: AppDatabase;
  preselectedInvoiceId?: string | null;
  onSaveScenario: (payload: {
    name: string;
    invoiceId: string;
    delayDays: number;
    revisedExpectedDate: string;
    extraMonthlyExpense: number;
  }) => Promise<void>;
}

export function SimulatorView({
  db,
  preselectedInvoiceId,
  onSaveScenario,
}: SimulatorViewProps) {
  const todayStr = getTodayISO();
  const studentMap = new Map(db.students.map((s) => [s.id, s]));

  const openInvoices = db.invoices.filter(
    (inv) => inv.status !== 'Draft' && getInvoiceRemaining(inv) > 0
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    preselectedInvoiceId || openInvoices[0]?.id || ''
  );
  const [delayDays, setDelayDays] = useState<number>(15);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [extraMonthlyExpense, setExtraMonthlyExpense] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preselectedInvoiceId && openInvoices.some((i) => i.id === preselectedInvoiceId)) {
      setSelectedInvoiceId(preselectedInvoiceId);
    } else if (!openInvoices.some((i) => i.id === selectedInvoiceId) && openInvoices[0]) {
      setSelectedInvoiceId(openInvoices[0].id);
    }
  }, [preselectedInvoiceId, openInvoices.length]);

  const selectedInvoice = openInvoices.find((i) => i.id === selectedInvoiceId) ?? openInvoices[0];
  const selectedStudent = selectedInvoice
    ? studentMap.get(selectedInvoice.studentId)
    : undefined;

  const result = simulateWhatIfScenario(db, {
    invoiceId: selectedInvoice?.id ?? '',
    delayDays,
    horizonDays,
    extraMonthlyExpense,
    todayStr,
  });

  const baseExpected = selectedInvoice
    ? selectedInvoice.expectedPaymentDate >= todayStr
      ? selectedInvoice.expectedPaymentDate
      : addDaysISO(todayStr, 2)
    : todayStr;
  const revisedDate = addDaysISO(baseExpected, delayDays);

  const handleSave = async () => {
    if (!selectedInvoice) return;
    setSaving(true);
    try {
      await onSaveScenario({
        name: `${selectedStudent?.fullName ?? 'Student'} +${delayDays}d delay${
          extraMonthlyExpense > 0 ? ` & +${formatINR(extraMonthlyExpense)}/mo` : ''
        }`,
        invoiceId: selectedInvoice.id,
        delayDays,
        revisedExpectedDate: revisedDate,
        extraMonthlyExpense,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
            What if things change?
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Explore how delayed payments and unexpected expenses affect your cash position.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-white border border-[#EAECF2]">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizonDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  horizonDays === d
                    ? 'bg-[#7257E8] text-white'
                    : 'text-[#717789] hover:text-[#171923]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedInvoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors disabled:opacity-50"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Scenario'}</span>
          </button>
        </div>
      </div>

      {/* Simulation Controls Card */}
      <div className="fintech-card p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#171923] border-b border-[#EAECF2] pb-3.5">
          <SlidersHorizontal className="w-4 h-4 text-[#7257E8]" />
          <span>Simulation Parameters</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Select Invoice */}
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1.5">
              1. Select Student Invoice
            </label>
            <select
              value={selectedInvoice?.id ?? ''}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2.5 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            >
              {openInvoices.length === 0 ? (
                <option value="">No open invoices available</option>
              ) : (
                openInvoices.map((inv) => {
                  const stu = studentMap.get(inv.studentId);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {stu?.fullName ?? 'Student'} — {formatINR(getInvoiceRemaining(inv))} (
                      {inv.invoiceNumber})
                    </option>
                  );
                })
              )}
            </select>
            {selectedInvoice && (
              <div className="text-[11px] text-[#717789] mt-2">
                Baseline: {formatFullDate(baseExpected)} → Delayed:{' '}
                <span className="text-[#7257E8] font-semibold">{formatFullDate(revisedDate)}</span>
              </div>
            )}
          </div>

          {/* 2. Delay Slider (0–30 days) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#717789]">
                2. Payment Delay Slider
              </label>
              <span className="text-xs font-mono font-bold text-[#EAA23B]">
                +{delayDays} days
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              {[0, 7, 15, 30].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDelayDays(preset)}
                  className={`flex-1 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors ${
                    delayDays === preset
                      ? 'bg-[#F0ECFF] border-[#7257E8] text-[#7257E8]'
                      : 'bg-[#F7F8FC] border-[#EAECF2] text-[#717789] hover:text-[#171923]'
                  }`}
                >
                  {preset === 0 ? 'On Time' : `+${preset}d`}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={30}
              value={delayDays}
              onChange={(e) => setDelayDays(Number(e.target.value))}
              className="w-full accent-[#7257E8]"
            />
          </div>

          {/* 3. Unexpected Monthly Expense */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#717789]">
                3. Unexpected Expense (₹/mo)
              </label>
              <span className="text-xs font-mono font-bold text-[#4779E8]">
                {formatINR(extraMonthlyExpense)}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={0}
                step={500}
                value={extraMonthlyExpense}
                onChange={(e) => setExtraMonthlyExpense(Math.max(0, Number(e.target.value) || 0))}
                className="w-28 rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
              {[0, 3000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExtraMonthlyExpense(amt)}
                  className={`flex-1 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors ${
                    extraMonthlyExpense === amt
                      ? 'bg-[#4779E8]/10 border-[#4779E8] text-[#4779E8]'
                      : 'bg-[#F7F8FC] border-[#EAECF2] text-[#717789] hover:text-[#171923]'
                  }`}
                >
                  {amt === 0 ? '₹0' : `+${amt / 1000}k`}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={15000}
              step={500}
              value={extraMonthlyExpense}
              onChange={(e) => setExtraMonthlyExpense(Number(e.target.value))}
              className="w-full accent-[#4779E8]"
            />
          </div>
        </div>
      </div>

      {/* 4 Comparison Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">
            Original Projected ({horizonDays}d)
          </div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
            {formatINR(result.baseline.projectedClosingBalance)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">
            Min point: {formatINR(result.baseline.lowestBalance.amount)} (
            {result.baseline.lowestBalance.label})
          </div>
        </div>

        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">
            Revised Projected ({horizonDays}d)
          </div>
          <div
            className={`text-xl font-display font-bold font-mono tabular-nums mt-1 ${
              result.simulated.lowestBalance.amount < 0 ? 'text-[#E35454]' : 'text-[#4779E8]'
            }`}
          >
            {formatINR(result.simulated.projectedClosingBalance)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">
            Min point: {formatINR(result.simulated.lowestBalance.amount)} (
            {result.simulated.lowestBalance.label})
          </div>
        </div>

        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">Difference</div>
          <div
            className={`text-xl font-display font-bold font-mono tabular-nums mt-1 ${
              result.lowestBalanceDiff < 0 ? 'text-[#EAA23B]' : 'text-[#16A36A]'
            }`}
          >
            {formatINR(result.lowestBalanceDiff)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">
            Closing diff: {formatINR(result.closingBalanceDiff)}
          </div>
        </div>

        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">Cash Shortage Risk</div>
          {result.newlyCreatedShortages.length > 0 ? (
            <>
              <div className="text-xl font-display font-bold font-mono tabular-nums text-[#E35454] mt-1">
                {formatINR(result.newlyCreatedShortages[0].shortfallAmount)}
              </div>
              <div className="text-[11px] text-[#E35454] font-medium mt-1">
                Deficit hits on {result.newlyCreatedShortages[0].label}
              </div>
            </>
          ) : result.simulated.lowestBalance.amount < 0 ? (
            <>
              <div className="text-xl font-display font-bold font-mono tabular-nums text-[#E35454] mt-1">
                {formatINR(Math.abs(result.simulated.lowestBalance.amount))}
              </div>
              <div className="text-[11px] text-[#E35454] font-medium mt-1">
                Existing deficit deepens
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-display font-bold text-[#16A36A] mt-1">No Deficit</div>
              <div className="text-[11px] text-[#717789] mt-1">Cash stays above ₹0</div>
            </>
          )}
        </div>
      </section>

      {/* Dual-Line Comparison Chart */}
      <div className="fintech-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display font-semibold text-base text-[#171923]">
              Baseline vs Simulated Cash Trajectory
            </h2>
            <p className="text-xs text-[#717789]">
              Comparing normal payment timing against +{delayDays}d delay for{' '}
              {selectedStudent?.fullName ?? 'selected student'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#717789]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#4779E8]" /> Baseline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#E35454]" /> Simulated Delay
            </span>
          </div>
        </div>

        <div className="h-[290px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={result.comparisonSeries}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#EAECF2" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#717789"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={22}
              />
              <YAxis
                stroke="#717789"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#EAECF2',
                  borderRadius: '12px',
                  boxShadow: '0 10px 28px rgba(23, 25, 35, 0.08)',
                  fontSize: '12px',
                  color: '#171923',
                }}
                formatter={(value) => formatINR(Number(value))}
              />
              <ReferenceLine y={0} stroke="#E35454" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="baselineBalance"
                name="Original Cash"
                stroke="#4779E8"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="simulatedBalance"
                name="Simulated Cash"
                stroke="#E35454"
                strokeWidth={2.5}
                strokeDasharray="5 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight Panel + Saved Scenarios */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 fintech-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            {result.newlyCreatedShortages.length > 0 || result.simulated.lowestBalance.amount < 0 ? (
              <AlertTriangle className="w-4 h-4 text-[#E35454]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
            )}
            <h3 className="font-display font-semibold text-base text-[#171923]">
              Deterministic Cash Insight
            </h3>
          </div>
          <p className="text-sm text-[#171923] leading-relaxed p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2]">
            {result.explanation}
          </p>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#717789]">
              Suggested Actions
            </div>
            <ul className="space-y-2 text-xs text-[#171923]">
              {result.suggestedActions.map((act, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono text-[#7257E8] font-bold">0{idx + 1}.</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="xl:col-span-5 fintech-card p-5 sm:p-6 space-y-3">
          <h3 className="font-display font-semibold text-base text-[#171923]">
            Saved Scenarios ({db.scenarios.length})
          </h3>
          <div className="divide-y divide-[#EAECF2]">
            {db.scenarios.slice(0, 5).map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  if (openInvoices.some((i) => i.id === sc.invoiceId)) {
                    setSelectedInvoiceId(sc.invoiceId);
                  }
                  setDelayDays(sc.delayDays);
                  setExtraMonthlyExpense(sc.extraMonthlyExpense);
                }}
                className="w-full py-3 text-left hover:bg-[#F7F8FC] px-2 rounded-lg transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#171923] truncate">{sc.name}</div>
                  <div className="text-[#717789] mt-0.5">
                    Delay +{sc.delayDays}d · Revised {formatFullDate(sc.revisedExpectedDate)}
                  </div>
                </div>
                <span className="text-[#7257E8] font-semibold shrink-0">Load</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
