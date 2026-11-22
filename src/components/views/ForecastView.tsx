import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Sliders, SlidersHorizontal } from 'lucide-react';
import type { AppDatabase } from '../../types/finance.ts';
import {
  computeCashFlowForecast,
  formatINR,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { StatusText } from '../ui/StatusText.tsx';

interface ForecastViewProps {
  db: AppDatabase;
  onSaveAssumptions: (payload: {
    collectionAssumptionPercent: number;
    includeRecurringTuitionInForecast: boolean;
  }) => Promise<void>;
  onOpenSimulator: () => void;
}

export function ForecastView({
  db,
  onSaveAssumptions,
  onOpenSimulator,
}: ForecastViewProps) {
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [collectionPercent, setCollectionPercent] = useState<number>(
    db.user.collectionAssumptionPercent ?? 100
  );
  const [includeRecurring, setIncludeRecurring] = useState<boolean>(
    db.user.includeRecurringTuitionInForecast ?? true
  );
  const [savingAssumptions, setSavingAssumptions] = useState(false);

  const todayStr = getTodayISO();
  const forecast = computeCashFlowForecast(db, {
    horizonDays,
    collectionAssumptionPercent: collectionPercent,
    includeRecurringTuition: includeRecurring,
    todayStr,
  });

  const eventDays = forecast.timeline.filter((pt) => pt.events.length > 0);

  const handlePersistAssumptions = async () => {
    setSavingAssumptions(true);
    try {
      await onSaveAssumptions({
        collectionAssumptionPercent: collectionPercent,
        includeRecurringTuitionInForecast: includeRecurring,
      });
    } finally {
      setSavingAssumptions(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
              Cash Flow Forecast
            </h1>
            <StatusText status={forecast.healthIndicator} />
          </div>
          <p className="text-sm text-[#717789] mt-0.5">
            Understand where your money is going before it happens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-white border border-[#EAECF2]">
            {([30, 60, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizonDays(days)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  horizonDays === days
                    ? 'bg-[#7257E8] text-white'
                    : 'text-[#717789] hover:text-[#171923]'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenSimulator}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>What-if Simulator</span>
          </button>
        </div>
      </div>

      {/* 4 Top Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">Current Balance</div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
            {formatINR(forecast.currentCash)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">Confirmed cash on hand</div>
        </div>

        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">
            Expected Inflow ({horizonDays}d)
          </div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-[#16A36A] mt-1">
            +{formatINR(forecast.totalExpectedIncome)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">
            {formatINR(forecast.confirmedReceivables)} issued ·{' '}
            {formatINR(forecast.projectedRecurringIncome)} recurring
          </div>
        </div>

        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">
            Expected Outflow ({horizonDays}d)
          </div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-[#EAA23B] mt-1">
            -{formatINR(forecast.totalExpectedExpenses)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">
            Scheduled rent, utilities &amp; bills
          </div>
        </div>

        <div className="fintech-card p-5">
          <div className="text-xs font-medium text-[#717789]">
            Projected Closing Balance ({horizonDays}d)
          </div>
          <div
            className={`text-2xl font-display font-bold font-mono tabular-nums mt-1 ${
              forecast.projectedClosingBalance < 0 ? 'text-[#E35454]' : 'text-[#7257E8]'
            }`}
          >
            {formatINR(forecast.projectedClosingBalance)}
          </div>
          <div className="text-[11px] text-[#717789] mt-1">
            Confirmed-only: {formatINR(forecast.confirmedClosingBalance)}
          </div>
        </div>
      </section>

      {/* Assumptions Bar */}
      <div className="fintech-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#171923]">
          <Sliders className="w-4 h-4 text-[#7257E8]" />
          <span>Forecast Assumptions</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#717789] whitespace-nowrap">
              Collection Rate Assumption:
            </label>
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={collectionPercent}
              onChange={(e) => setCollectionPercent(Number(e.target.value))}
              className="w-28 accent-[#7257E8]"
            />
            <span className="text-xs font-mono font-semibold tabular-nums text-[#7257E8] w-10">
              {collectionPercent}%
            </span>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-[#171923] cursor-pointer">
            <input
              type="checkbox"
              checked={includeRecurring}
              onChange={(e) => setIncludeRecurring(e.target.checked)}
              className="accent-[#7257E8]"
            />
            Include projected recurring tuition cycles
          </label>

          <button
            type="button"
            onClick={handlePersistAssumptions}
            disabled={savingAssumptions}
            className="px-3.5 py-1.5 rounded-[9px] text-xs font-semibold bg-[#F7F8FC] text-[#171923] border border-[#EAECF2] hover:border-[#7257E8] hover:text-[#7257E8] transition-colors disabled:opacity-50"
          >
            {savingAssumptions ? 'Saving...' : 'Save as Default'}
          </button>
        </div>
      </div>

      {/* Cash Trajectory Chart */}
      <div className="fintech-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display font-semibold text-base text-[#171923]">
              {horizonDays}-Day Daily Cash Runway
            </h2>
            <p className="text-xs text-[#717789]">
              Red dashed line marks ₹0 deficit threshold; amber line marks your{' '}
              {formatINR(db.user.safetyBufferAmount)} safety cushion
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#717789]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7257E8]" /> Projected Total
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4779E8]" /> Confirmed Invoices Only
            </span>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={forecast.timeline}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="projLightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7257E8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7257E8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAECF2" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#717789"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
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
              <ReferenceLine
                y={db.user.safetyBufferAmount}
                stroke="#EAA23B"
                strokeDasharray="3 3"
              />
              <Area
                type="monotone"
                dataKey="projectedBalance"
                name="Projected Cash"
                stroke="#7257E8"
                strokeWidth={2.5}
                fill="url(#projLightGrad)"
              />
              <Area
                type="monotone"
                dataKey="confirmedBalance"
                name="Confirmed Invoices Only"
                stroke="#4779E8"
                strokeWidth={2}
                fillOpacity={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shortage Alerts + Confirmed vs Projected Event Schedule */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 fintech-card p-5 sm:p-6 space-y-3">
          <h3 className="font-display font-semibold text-base text-[#171923]">
            Financial Health &amp; Risk Dates
          </h3>
          {forecast.shortageDates.length > 0 ? (
            <div className="space-y-2.5">
              {forecast.shortageDates.slice(0, 5).map((sd) => (
                <div
                  key={sd.date}
                  className="p-3.5 rounded-xl bg-[#E35454]/8 border border-[#E35454]/25 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold text-[#E35454]">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {sd.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatINR(sd.projectedBalance)}
                    </span>
                  </div>
                  <p className="text-[#171923]">{sd.cause}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs space-y-2">
              <div className="inline-flex items-center gap-1.5 font-semibold text-[#16A36A]">
                <CheckCircle2 className="w-4 h-4" />
                Zero negative cash dates in the next {horizonDays} days
              </div>
              <p className="text-[#717789] leading-relaxed">
                Lowest projected balance is{' '}
                <span className="font-mono font-semibold text-[#171923]">
                  {formatINR(forecast.lowestBalance.amount)}
                </span>{' '}
                on {forecast.lowestBalance.label}.
                {forecast.lowestBalance.amount < db.user.safetyBufferAmount &&
                  ` Note: This dips below your ${formatINR(
                    db.user.safetyBufferAmount
                  )} target safety buffer.`}
              </p>
            </div>
          )}
        </div>

        <div className="xl:col-span-7 fintech-card p-5 sm:p-6">
          <h3 className="font-display font-semibold text-base text-[#171923] mb-3">
            Confirmed &amp; Projected Cash Events ({eventDays.length} days)
          </h3>
          <div className="max-h-72 overflow-y-auto divide-y divide-[#EAECF2]">
            {eventDays.map((pt) => (
              <div
                key={pt.date}
                className="py-3 flex items-start justify-between gap-4 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#171923]">{pt.label}</div>
                  <div className="text-[#717789] space-y-0.5 mt-0.5">
                    {pt.events.map((ev, i) => (
                      <div key={i}>{ev}</div>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-mono font-semibold tabular-nums ${
                      pt.projectedBalance < 0 ? 'text-[#E35454]' : 'text-[#171923]'
                    }`}
                  >
                    {formatINR(pt.projectedBalance)}
                  </div>
                  <div className="text-[11px] text-[#717789]">
                    Confirmed: {formatINR(pt.confirmedBalance)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
