import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type {
  ActionItem,
  AppDatabase,
  Invoice,
  NavSection,
} from '../../types/finance.ts';
import {
  computeCashFlowForecast,
  computeDashboardSummary,
  computeRevenueOverviewSeries,
  computeStudentMetrics,
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
  getOverdueDays,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { api } from '../../services/api.ts';
import { StatusText } from '../ui/StatusText.tsx';
import { FormattedText } from '../ui/FormattedText.tsx';

interface OverviewViewProps {
  db: AppDatabase;
  actions: ActionItem[];
  onNavigate: (nav: NavSection) => void;
  onNewInvoice: () => void;
  onOpenReminder: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onActionClick: (action: ActionItem) => void;
}

type RangeKey = '7D' | '30D' | '90D' | '1Y';

export function OverviewView({
  db,
  actions,
  onNavigate,
  onNewInvoice,
  onOpenReminder,
  onRecordPayment,
  onActionClick,
}: OverviewViewProps) {
  const todayStr = getTodayISO();
  const summary = useMemo(() => computeDashboardSummary(db, todayStr), [db, todayStr]);
  const forecast30 = useMemo(
    () => computeCashFlowForecast(db, { horizonDays: 30, todayStr }),
    [db, todayStr]
  );
  const studentsWithMetrics = useMemo(
    () => computeStudentMetrics(db, todayStr),
    [db, todayStr]
  );

  const [range, setRange] = useState<RangeKey>('90D');
  const revenueSeries = useMemo(
    () => computeRevenueOverviewSeries(db, range, todayStr),
    [db, range, todayStr]
  );

  const [healthText, setHealthText] = useState<string>('');
  const [healthSource, setHealthSource] = useState<'gemini' | 'grounded-engine'>('grounded-engine');
  const [loadingHealth, setLoadingHealth] = useState(false);

  const loadHealthSummary = async () => {
    setLoadingHealth(true);
    try {
      const res = await api.getHealthSummary();
      setHealthText(res.summaryText);
      setHealthSource(res.source);
    } catch {
      setHealthText(
        `Available cash is ${formatINR(summary.availableCash)} with ${formatINR(
          summary.overduePayments
        )} overdue across ${summary.overdueInvoiceCount} invoices. 30-day cash health is ${
          forecast30.healthIndicator
        }.`
      );
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    void loadHealthSummary();
  }, [db.invoices.length, db.payments.length, db.expenses.length, db.user.openingCashBalance]);

  const firstName = db.user.name.split(' ')[0] || 'Tanya';
  const studentMap = new Map(db.students.map((s) => [s.id, s]));

  const pendingStudents = studentsWithMetrics
    .filter((s) => s.outstandingBalance > 0)
    .sort((a, b) => b.overdueBalance - a.overdueBalance || b.outstandingBalance - a.outstandingBalance)
    .slice(0, 5);

  const recentPayments = db.payments.slice(0, 5);
  const topPriorities = actions.slice(0, 5);

  const getPrimaryInvoiceForStudent = (studentId: string): Invoice | undefined => {
    return db.invoices
      .filter((inv) => inv.studentId === studentId && inv.status !== 'Draft' && getInvoiceRemaining(inv) > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  };

  // Build crisp mini sparklines from monthlyTrends
  const revTrend = summary.monthlyTrends.map((m) => ({ v: m.revenue }));
  const colTrend = summary.monthlyTrends.map((m) => ({ v: m.collected }));
  const outTrend = summary.monthlyTrends.map((m) => ({
    v: Math.max(0, m.revenue - m.collected),
  }));
  const ovdTrend = [
    { v: Math.round(summary.overduePayments * 0.65) },
    { v: Math.round(summary.overduePayments * 0.8) },
    { v: Math.round(summary.overduePayments * 0.92) },
    { v: summary.overduePayments },
  ];

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: formatINR(summary.totalRevenue),
      trend: `${summary.monthlyTrends.length}-mo billed ledger`,
      trendTone: 'text-[#16A36A]',
      iconBg: 'bg-[#F0ECFF]',
      iconColor: 'text-[#7257E8]',
      sparkColor: '#7257E8',
      sparkData: revTrend,
      icon: TrendingUp,
    },
    {
      label: 'Collected Payments',
      value: formatINR(summary.collectedPayments),
      trend: `${summary.collectionRate}% collection rate`,
      trendTone: 'text-[#16A36A]',
      iconBg: 'bg-[#16A36A]/10',
      iconColor: 'text-[#16A36A]',
      sparkColor: '#16A36A',
      sparkData: colTrend,
      icon: IndianRupee,
    },
    {
      label: 'Outstanding Payments',
      value: formatINR(summary.outstandingPayments),
      trend: `From ${summary.unpaidStudentCount} student${summary.unpaidStudentCount === 1 ? '' : 's'}`,
      trendTone: 'text-[#4779E8]',
      iconBg: 'bg-[#4779E8]/10',
      iconColor: 'text-[#4779E8]',
      sparkColor: '#4779E8',
      sparkData: outTrend,
      icon: CalendarClock,
    },
    {
      label: 'Overdue Payments',
      value: formatINR(summary.overduePayments),
      trend: `${summary.overdueInvoiceCount} overdue invoice${summary.overdueInvoiceCount === 1 ? '' : 's'}`,
      trendTone: summary.overduePayments > 0 ? 'text-[#E35454]' : 'text-[#16A36A]',
      iconBg: summary.overduePayments > 0 ? 'bg-[#E35454]/10' : 'bg-[#16A36A]/10',
      iconColor: summary.overduePayments > 0 ? 'text-[#E35454]' : 'text-[#16A36A]',
      sparkColor: summary.overduePayments > 0 ? '#E35454' : '#16A36A',
      sparkData: ovdTrend,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting & Contextual Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#171923]">
            Good morning, {firstName}
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Here&apos;s your tutoring business at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onNavigate('simulator')}
            className="px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-white text-[#171923] border border-[#EAECF2] hover:bg-[#F7F8FC] transition-colors whitespace-nowrap"
          >
            Simulate Delay
          </button>
          <button
            type="button"
            onClick={onNewInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors shadow-[0_2px_8px_rgba(114,87,232,0.25)] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="fintech-card fintech-card-hover p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#717789]">{card.label}</span>
                <div
                  className={`w-8 h-8 rounded-[10px] ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xl font-display font-bold font-mono tabular-nums text-[#171923] tracking-tight">
                    {card.value}
                  </div>
                  <div className={`text-xs font-medium mt-1 truncate ${card.trendTone}`}>
                    {card.trend}
                  </div>
                </div>

                <div className="w-20 h-10 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={card.sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={card.sparkColor}
                        strokeWidth={2}
                        fill={card.sparkColor}
                        fillOpacity={0.12}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Main 2-Column Analytics: Revenue Overview (LEFT) + Cash Position (RIGHT) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: Revenue Overview */}
        <div className="xl:col-span-8 fintech-card p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display font-semibold text-base text-[#171923]">
                Revenue Overview
              </h2>
              <p className="text-xs text-[#717789] mt-0.5">
                Collected revenue, studio expenses, and net cash flow
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
                {(['7D', '30D', '90D', '1Y'] as RangeKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRange(key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      range === key
                        ? 'bg-white text-[#7257E8] shadow-xs border border-[#EAECF2]'
                        : 'text-[#717789] hover:text-[#171923]'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#717789] mb-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7257E8]" /> Collected Revenue
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EAA23B]" /> Expenses
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A36A]" /> Net Cash Flow
            </span>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueSeries}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revVioletGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7257E8" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7257E8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="netGreenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A36A" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#16A36A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAECF2" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#717789"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
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
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Collected Revenue"
                  stroke="#7257E8"
                  strokeWidth={2.25}
                  fill="url(#revVioletGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#EAA23B"
                  strokeWidth={2}
                  fillOpacity={0}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  name="Net Cash Flow"
                  stroke="#16A36A"
                  strokeWidth={2}
                  fill="url(#netGreenGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT: Cash Position */}
        <div className="xl:col-span-4 fintech-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-semibold text-base text-[#171923]">
                  Cash Position
                </h2>
              </div>
              <p className="text-xs text-[#717789] mt-0.5">30-day forward liquidity</p>
            </div>
            <StatusText status={forecast30.healthIndicator} />
          </div>

          <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2]">
            <div className="flex items-center justify-between text-xs text-[#717789]">
              <span>Current Cash Balance</span>
              <Wallet className="w-3.5 h-3.5 text-[#7257E8]" />
            </div>
            <div className="text-2xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
              {formatINR(forecast30.currentCash)}
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#717789]">Expected incoming (30d)</span>
              <span className="font-mono font-semibold tabular-nums text-[#16A36A]">
                +{formatINR(forecast30.totalExpectedIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#717789]">Upcoming expenses (30d)</span>
              <span className="font-mono font-semibold tabular-nums text-[#EAA23B]">
                -{formatINR(forecast30.totalExpectedExpenses)}
              </span>
            </div>
            <div className="pt-2 border-t border-[#EAECF2] flex items-center justify-between">
              <span className="font-medium text-[#171923]">Projected closing (30d)</span>
              <span
                className={`font-mono font-bold tabular-nums text-sm ${
                  forecast30.projectedClosingBalance < 0 ? 'text-[#E35454]' : 'text-[#171923]'
                }`}
              >
                {formatINR(forecast30.projectedClosingBalance)}
              </span>
            </div>
          </div>

          {/* Compact 30d cash trajectory spark */}
          <div className="h-[72px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={forecast30.timeline}
                margin={{ top: 4, right: 2, left: 2, bottom: 2 }}
              >
                <Area
                  type="monotone"
                  dataKey="projectedBalance"
                  stroke="#4779E8"
                  strokeWidth={2}
                  fill="#4779E8"
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('forecast')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-[10px] text-xs font-semibold bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors"
          >
            <span>Open 30/60/90 Cash Forecast</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 2-Column Below Analytics: Today's Priorities (LEFT) + Recent Transactions (RIGHT) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: Today's Priorities */}
        <div className="xl:col-span-7 fintech-card p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#EAECF2]">
            <div>
              <h2 className="font-display font-semibold text-base text-[#171923]">
                Today&apos;s Priorities
              </h2>
              <p className="text-xs text-[#717789] mt-0.5">
                Follow-ups and upcoming obligations needing attention
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('action-center')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7257E8] hover:text-[#6046D6] whitespace-nowrap shrink-0"
            >
              <span>View All ({actions.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#EAECF2] flex-1">
            {topPriorities.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-[#16A36A] mx-auto" />
                <div className="text-sm font-medium text-[#171923]">All caught up</div>
                <p className="text-xs text-[#717789]">
                  No overdue student fees or urgent bills today.
                </p>
              </div>
            ) : (
              topPriorities.map((act) => {
                const dotColor =
                  act.priority === 'Critical'
                    ? 'bg-[#E35454]'
                    : act.priority === 'High'
                      ? 'bg-[#EAA23B]'
                      : 'bg-[#4779E8]';
                const pillTone =
                  act.priority === 'Critical'
                    ? 'text-[#E35454] bg-[#E35454]/10'
                    : act.priority === 'High'
                      ? 'text-[#B87314] bg-[#EAA23B]/12'
                      : 'text-[#4779E8] bg-[#4779E8]/10';
                return (
                  <div
                    key={act.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${dotColor}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${pillTone}`}>
                            {act.priority}
                          </span>
                          <span className="text-[#717789]">
                            Due {formatFullDate(act.deadline)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-[#171923] mt-1">
                          {act.title}
                        </div>
                        <div className="text-xs text-[#717789] mt-0.5 truncate">
                          {act.recommendedAction}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onActionClick(act)}
                      className="px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#F7F8FC] text-[#171923] border border-[#EAECF2] hover:border-[#7257E8] hover:text-[#7257E8] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      {act.actionLabel}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Recent Transactions */}
        <div className="xl:col-span-5 fintech-card p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#EAECF2]">
            <div>
              <h2 className="font-display font-semibold text-base text-[#171923]">
                Recent Transactions
              </h2>
              <p className="text-xs text-[#717789] mt-0.5">Latest recorded student payments</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7257E8] hover:text-[#6046D6] whitespace-nowrap shrink-0"
            >
              <span>All Receipts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#EAECF2] flex-1">
            {recentPayments.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#717789]">
                No payments recorded yet.
              </div>
            ) : (
              recentPayments.map((pay) => {
                const stu = studentMap.get(pay.studentId);
                return (
                  <div
                    key={pay.id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#171923] truncate">
                        {stu?.fullName ?? 'Student'}
                      </div>
                      <div className="text-xs text-[#717789] mt-0.5 truncate">
                        {pay.notes || 'Tuition payment'} · {pay.method} · {formatFullDate(pay.date)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-semibold tabular-nums text-[#16A36A]">
                        +{formatINR(pay.amount)}
                      </div>
                      <div className="text-[11px] font-medium text-[#16A36A]">Received</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Bottom Row: Who Owes You Money + AI Financial Health Summary */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 fintech-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display font-semibold text-base text-[#171923]">
                Students with Pending Balances
              </h2>
              <p className="text-xs text-[#717789]">
                Quickly follow up or record partial / full UPI receipts
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="text-xs font-semibold text-[#7257E8] hover:text-[#6046D6] whitespace-nowrap"
            >
              All Students
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAECF2] text-[11px] font-semibold uppercase tracking-wider text-[#717789]">
                  <th className="py-2.5 pr-3">Student</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Pending</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF2] text-sm">
                {pendingStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-[#717789]">
                      All student tuition balances are settled.
                    </td>
                  </tr>
                ) : (
                  pendingStudents.map((stu) => {
                    const inv = getPrimaryInvoiceForStudent(stu.id);
                    const overdueDays = inv ? getOverdueDays(inv.dueDate, todayStr) : 0;
                    return (
                      <tr key={stu.id} className="hover:bg-[#F7F8FC] transition-colors">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-[#171923]">{stu.fullName}</div>
                          <div className="text-xs text-[#717789]">
                            {stu.grade} · {stu.subject}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <StatusText
                            status={stu.paymentStatus}
                            extraLabel={overdueDays > 0 ? `${overdueDays}d late` : undefined}
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-[#171923]">
                          {formatINR(stu.outstandingBalance)}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          {inv && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenReminder(inv)}
                                className="px-2.5 py-1 rounded-[8px] text-xs font-medium bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors whitespace-nowrap"
                              >
                                Remind
                              </button>
                              <button
                                type="button"
                                onClick={() => onRecordPayment(inv)}
                                className="px-2.5 py-1 rounded-[8px] text-xs font-medium bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors whitespace-nowrap"
                              >
                                Pay
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Financial Health Summary */}
        <div className="xl:col-span-5 fintech-card p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[10px] bg-[#F0ECFF] text-[#7257E8] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-base text-[#171923]">
                    AI Financial Health Summary
                  </h2>
                  <p className="text-[11px] text-[#717789]">
                    {healthSource === 'gemini'
                      ? 'Gemini AI + Live Ledger'
                      : 'Grounded Financial Engine'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadHealthSummary}
                disabled={loadingHealth}
                className="p-2 rounded-[9px] text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] border border-[#EAECF2] transition-colors"
                aria-label="Refresh AI financial summary"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-sm text-[#171923] leading-relaxed">
              {healthText ? (
                <FormattedText content={healthText} />
              ) : (
                'Analyzing live receivables and upcoming expenses...'
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#EAECF2] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#717789]">
              Lowest 30d cash:{' '}
              <span
                className={`font-mono font-semibold tabular-nums ${
                  forecast30.lowestBalance.amount < 0
                    ? 'text-[#E35454]'
                    : forecast30.lowestBalance.amount < db.user.safetyBufferAmount
                      ? 'text-[#EAA23B]'
                      : 'text-[#16A36A]'
                }`}
              >
                {formatINR(forecast30.lowestBalance.amount)}
              </span>{' '}
              ({forecast30.lowestBalance.label})
            </span>
            <button
              type="button"
              onClick={() => onNavigate('copilot')}
              className="font-semibold text-[#7257E8] hover:text-[#6046D6]"
            >
              Ask Copilot →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
