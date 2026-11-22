import type {
  ActionItem,
  AppDatabase,
  CashFlowForecast,
  DashboardSummary,
  Expense,
  ForecastPoint,
  Invoice,
  InvoiceStatus,
  MonthlyTrendPoint,
  ShortageDate,
  SimulationResult,
  StudentWithMetrics,
} from '../types/finance.ts';
import { addDaysISO } from './seedData.ts';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const absFormatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.abs(rounded));
  return rounded < 0 ? `-₹${absFormatted}` : `₹${absFormatted}`;
}

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function diffDaysISO(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function deriveInvoiceStatus(
  invoice: Invoice,
  todayStr = getTodayISO()
): InvoiceStatus {
  if (invoice.paidAmount >= invoice.totalAmount && invoice.totalAmount > 0) {
    return 'Paid';
  }
  if (invoice.status === 'Draft') {
    return 'Draft';
  }
  if (diffDaysISO(invoice.dueDate, todayStr) > 0) {
    return 'Overdue';
  }
  if (invoice.paidAmount > 0) {
    return 'Partially Paid';
  }
  return 'Unpaid';
}

export function getInvoiceRemaining(invoice: Invoice): number {
  return Math.max(0, invoice.totalAmount - invoice.paidAmount);
}

export function getOverdueDays(dueDate: string, todayStr = getTodayISO()): number {
  return Math.max(0, diffDaysISO(dueDate, todayStr));
}

export function computeStudentMetrics(
  db: AppDatabase,
  todayStr = getTodayISO()
): StudentWithMetrics[] {
  return db.students.map((student) => {
    const stuInvoices = db.invoices.filter((inv) => inv.studentId === student.id);
    const activeInvoices = stuInvoices.filter((inv) => inv.status !== 'Draft');
    let outstandingBalance = 0;
    let overdueBalance = 0;
    let paidTotal = 0;
    let oldestOverdueDays = 0;
    let hasPartial = false;

    for (const inv of activeInvoices) {
      const status = deriveInvoiceStatus(inv, todayStr);
      const remaining = getInvoiceRemaining(inv);
      paidTotal += inv.paidAmount;
      if (status !== 'Paid') {
        outstandingBalance += remaining;
      }
      if (status === 'Overdue') {
        overdueBalance += remaining;
        const od = getOverdueDays(inv.dueDate, todayStr);
        if (od > oldestOverdueDays) oldestOverdueDays = od;
      }
      if (inv.paidAmount > 0 && remaining > 0) {
        hasPartial = true;
      }
    }

    let paymentStatus: StudentWithMetrics['paymentStatus'] = 'paid';
    if (overdueBalance > 0) paymentStatus = 'overdue';
    else if (hasPartial) paymentStatus = 'partial';
    else if (outstandingBalance > 0) paymentStatus = 'pending';

    return {
      ...student,
      outstandingBalance,
      overdueBalance,
      paidTotal,
      paymentStatus,
      oldestOverdueDays,
      invoiceCount: stuInvoices.length,
    };
  });
}

export function computeMonthlyTrends(
  db: AppDatabase,
  todayStr = getTodayISO()
): MonthlyTrendPoint[] {
  const [y, m] = todayStr.split('-').map(Number);
  const points: MonthlyTrendPoint[] = [];

  for (let offset = 3; offset >= 0; offset--) {
    const dt = new Date(y, m - 1 - offset, 1);
    const year = dt.getFullYear();
    const monthIdx = dt.getMonth();
    const label = dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

    const monthInvoices = db.invoices.filter((inv) => {
      if (inv.status === 'Draft') return false;
      const [iy, im] = inv.issueDate.split('-').map(Number);
      return iy === year && im - 1 === monthIdx;
    });

    const monthPayments = db.payments.filter((pay) => {
      const [py, pm] = pay.date.split('-').map(Number);
      return py === year && pm - 1 === monthIdx;
    });

    const monthExpenses = db.expenses.filter((exp) => {
      const [ey, em] = exp.dueDate.split('-').map(Number);
      return ey === year && em - 1 === monthIdx;
    });

    const revenue = monthInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const collected = monthPayments.reduce((acc, p) => acc + p.amount, 0);
    const expenses = monthExpenses.reduce((acc, e) => acc + e.amount, 0);

    points.push({
      month: label,
      revenue,
      collected,
      expenses,
      net: collected - expenses,
    });
  }

  return points;
}

export function computeDashboardSummary(
  db: AppDatabase,
  todayStr = getTodayISO()
): DashboardSummary {
  const nonDraftInvoices = db.invoices.filter((inv) => inv.status !== 'Draft');
  let totalRevenue = 0;
  let collectedPayments = 0;
  let outstandingPayments = 0;
  let overduePayments = 0;
  let overdueInvoiceCount = 0;
  let unpaidBalance = 0;
  let partialBalance = 0;
  let overdueCount = 0;
  let unpaidCount = 0;
  let partialCount = 0;

  const unpaidStudentIds = new Set<string>();

  for (const inv of nonDraftInvoices) {
    const status = deriveInvoiceStatus(inv, todayStr);
    const remaining = getInvoiceRemaining(inv);
    totalRevenue += inv.totalAmount;
    collectedPayments += inv.paidAmount;

    if (remaining > 0) {
      outstandingPayments += remaining;
      unpaidStudentIds.add(inv.studentId);
    }

    if (status === 'Overdue') {
      overduePayments += remaining;
      overdueInvoiceCount += 1;
      overdueCount += 1;
    } else if (status === 'Partially Paid') {
      partialBalance += remaining;
      partialCount += 1;
    } else if (status === 'Unpaid') {
      unpaidBalance += remaining;
      unpaidCount += 1;
    }
  }

  const [ty, tm] = todayStr.split('-').map(Number);
  const currentMonthExpenses = db.expenses
    .filter((exp) => {
      const [ey, em] = exp.dueDate.split('-').map(Number);
      return ey === ty && em === tm;
    })
    .reduce((acc, exp) => acc + exp.amount, 0);

  const upcoming30dExpenses = db.expenses
    .filter((exp) => {
      if (exp.status === 'Paid') return false;
      const d = diffDaysISO(todayStr, exp.dueDate);
      return d >= -7 && d <= 30;
    })
    .reduce((acc, exp) => acc + exp.amount, 0);

  const monthlyExpenses =
    currentMonthExpenses > 0 ? currentMonthExpenses : upcoming30dExpenses;

  return {
    totalRevenue,
    collectedPayments,
    outstandingPayments,
    overduePayments,
    monthlyExpenses,
    availableCash: db.user.openingCashBalance,
    collectionRate:
      totalRevenue > 0 ? Math.round((collectedPayments / totalRevenue) * 100) : 100,
    overdueInvoiceCount,
    unpaidStudentCount: unpaidStudentIds.size,
    monthlyTrends: computeMonthlyTrends(db, todayStr),
    outstandingBreakdown: [
      { name: 'Overdue', value: overduePayments, count: overdueCount, color: '#E35454' },
      { name: 'Partially Paid', value: partialBalance, count: partialCount, color: '#EAA23B' },
      { name: 'Upcoming Due', value: unpaidBalance, count: unpaidCount, color: '#4779E8' },
    ].filter((item) => item.value > 0),
  };
}

export interface RevenueSeriesPoint {
  label: string;
  collected: number;
  expenses: number;
  net: number;
}

export function computeRevenueOverviewSeries(
  db: AppDatabase,
  range: '7D' | '30D' | '90D' | '1Y',
  todayStr = getTodayISO()
): RevenueSeriesPoint[] {
  if (range === '7D') {
    const pts: RevenueSeriesPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDaysISO(todayStr, -i);
      const collected = db.payments
        .filter((p) => p.date === date)
        .reduce((acc, p) => acc + p.amount, 0);
      const expenses = db.expenses
        .filter((e) => (e.paidDate ?? e.dueDate) === date && e.status === 'Paid')
        .reduce((acc, e) => acc + e.amount, 0);
      pts.push({
        label: formatShortDate(date),
        collected,
        expenses,
        net: collected - expenses,
      });
    }
    return pts;
  }

  if (range === '30D') {
    // 5 weekly buckets over last 30 days
    const pts: RevenueSeriesPoint[] = [];
    for (let w = 4; w >= 0; w--) {
      const start = addDaysISO(todayStr, -(w * 6 + 5));
      const end = addDaysISO(todayStr, -(w * 6));
      const collected = db.payments
        .filter((p) => p.date >= start && p.date <= end)
        .reduce((acc, p) => acc + p.amount, 0);
      const expenses = db.expenses
        .filter((e) => {
          const d = e.paidDate ?? e.dueDate;
          return d >= start && d <= end;
        })
        .reduce((acc, e) => acc + e.amount, 0);
      pts.push({
        label: formatShortDate(end),
        collected,
        expenses,
        net: collected - expenses,
      });
    }
    return pts;
  }

  if (range === '90D') {
    return computeMonthlyTrends(db, todayStr).map((m) => ({
      label: m.month,
      collected: m.collected,
      expenses: m.expenses,
      net: m.net,
    }));
  }

  // 1Y: last 6 months from ledger
  const [y, m] = todayStr.split('-').map(Number);
  const pts: RevenueSeriesPoint[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const dt = new Date(y, m - 1 - offset, 1);
    const yr = dt.getFullYear();
    const mo = dt.getMonth();
    const label = dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const collected = db.payments
      .filter((p) => {
        const [py, pm] = p.date.split('-').map(Number);
        return py === yr && pm - 1 === mo;
      })
      .reduce((acc, p) => acc + p.amount, 0);
    const expenses = db.expenses
      .filter((e) => {
        const [ey, em] = e.dueDate.split('-').map(Number);
        return ey === yr && em - 1 === mo;
      })
      .reduce((acc, e) => acc + e.amount, 0);
    pts.push({ label, collected, expenses, net: collected - expenses });
  }
  return pts;
}

export function getStudentNextDueDate(
  studentId: string,
  paymentDueDay: number,
  invoices: Invoice[],
  todayStr = getTodayISO()
): string {
  const openInvs = invoices
    .filter((i) => i.studentId === studentId && i.status !== 'Draft' && getInvoiceRemaining(i) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (openInvs.length > 0) {
    return openInvs[0].dueDate;
  }
  const [y, m, d] = todayStr.split('-').map(Number);
  const targetMonth = d <= paymentDueDay ? m - 1 : m;
  const dt = new Date(y, targetMonth, Math.min(28, paymentDueDay));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export interface ForecastOptions {
  horizonDays?: 30 | 60 | 90;
  collectionAssumptionPercent?: number;
  includeRecurringTuition?: boolean;
  invoiceDateOverrides?: Record<string, string>;
  extraMonthlyExpense?: number;
  todayStr?: string;
}

export function computeCashFlowForecast(
  db: AppDatabase,
  options: ForecastOptions = {}
): CashFlowForecast {
  const todayStr = options.todayStr ?? getTodayISO();
  const horizonDays = options.horizonDays ?? 30;
  const collectionPercent =
    options.collectionAssumptionPercent ?? db.user.collectionAssumptionPercent ?? 100;
  const includeRecurring =
    options.includeRecurringTuition ?? db.user.includeRecurringTuitionInForecast ?? true;
  const overrides = options.invoiceDateOverrides ?? {};
  const extraMonthlyExpense = options.extraMonthlyExpense ?? 0;

  const studentMap = new Map(db.students.map((s) => [s.id, s]));

  // Map daily events for day 0..horizonDays
  const confirmedInflowsByDay = new Map<number, { amount: number; labels: string[] }>();
  const projectedInflowsByDay = new Map<number, { amount: number; labels: string[] }>();
  const outflowsByDay = new Map<number, { amount: number; labels: string[] }>();

  const addEntry = (
    map: Map<number, { amount: number; labels: string[] }>,
    dayOffset: number,
    amount: number,
    label: string
  ) => {
    if (amount <= 0) return;
    const clampedDay = Math.max(0, dayOffset);
    if (clampedDay > horizonDays) return;
    const prev = map.get(clampedDay) ?? { amount: 0, labels: [] };
    prev.amount += amount;
    prev.labels.push(label);
    map.set(clampedDay, prev);
  };

  // 1. Existing unpaid / partially paid / overdue invoices
  for (const inv of db.invoices) {
    if (inv.status === 'Draft') continue;
    const remaining = getInvoiceRemaining(inv);
    if (remaining <= 0) continue;

    const studentName = studentMap.get(inv.studentId)?.fullName ?? 'Student';
    const expectedDate = overrides[inv.id] ?? inv.expectedPaymentDate ?? inv.dueDate;
    const offset = diffDaysISO(todayStr, expectedDate);
    // If expected date was in the past but still unpaid, assume earliest realistic receipt at Day +2 unless overridden
    const effectiveDay =
      overrides[inv.id] !== undefined ? Math.max(0, offset) : Math.max(1, offset);

    if (effectiveDay <= horizonDays) {
      const status = deriveInvoiceStatus(inv, todayStr);
      const isUncertain = status === 'Overdue' || inv.paidAmount === 0;
      const weightedAmount = isUncertain
        ? Math.round((remaining * collectionPercent) / 100)
        : remaining;

      addEntry(
        confirmedInflowsByDay,
        effectiveDay,
        weightedAmount,
        `+${formatINR(weightedAmount)} ${studentName} (${inv.invoiceNumber})`
      );
    }
  }

  // 2. Projected recurring monthly tuition cycles (days 31..90, or next cycle for students)
  if (includeRecurring && horizonDays >= 30) {
    const activeStudents = db.students.filter((s) => s.status === 'active');
    const [ty, tm, td] = todayStr.split('-').map(Number);

    for (const student of activeStudents) {
      // Generate future billing cycles starting from next month (+1, +2, +3 months)
      for (let mOffset = 1; mOffset <= 3; mOffset++) {
        const cycleDate = new Date(ty, tm - 1 + mOffset, Math.min(student.paymentDueDay, 28));
        const cycleISO = `${cycleDate.getFullYear()}-${String(cycleDate.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(cycleDate.getDate()).padStart(2, '0')}`;
        const dayOffset = diffDaysISO(todayStr, cycleISO);

        if (dayOffset >= 22 && dayOffset <= horizonDays) {
          const weighted = Math.round((student.monthlyFee * collectionPercent) / 100);
          addEntry(
            projectedInflowsByDay,
            dayOffset,
            weighted,
            `+${formatINR(weighted)} Projected tuition (${student.fullName})`
          );
        }
      }
    }
    void td;
  }

  // 3. Upcoming and recurring expenses (only project from active Upcoming/Overdue bills, not historical Paid receipts)
  for (const exp of db.expenses) {
    if (exp.status === 'Paid') {
      continue;
    }

    const baseOffset = Math.max(0, diffDaysISO(todayStr, exp.dueDate));
    if (baseOffset <= horizonDays) {
      addEntry(outflowsByDay, baseOffset, exp.amount, `-${formatINR(exp.amount)} ${exp.title}`);
    }

    if (exp.isRecurring && exp.frequency === 'monthly') {
      for (let m = 1; m <= 2; m++) {
        const nextDue = addDaysISO(exp.dueDate, 30 * m);
        const nextOffset = diffDaysISO(todayStr, nextDue);
        if (nextOffset > baseOffset && nextOffset <= horizonDays) {
          addEntry(
            outflowsByDay,
            nextOffset,
            exp.amount,
            `-${formatINR(exp.amount)} ${exp.title} (Recurring)`
          );
        }
      }
    }
  }

  // 4. Optional simulated extra monthly expense
  if (extraMonthlyExpense > 0) {
    for (let day = 15; day <= horizonDays; day += 30) {
      addEntry(
        outflowsByDay,
        day,
        extraMonthlyExpense,
        `-${formatINR(extraMonthlyExpense)} Simulated Monthly Expense`
      );
    }
  }

  // Build daily timeline
  const timeline: ForecastPoint[] = [];
  let confirmedRunning = db.user.openingCashBalance;
  let projectedRunning = db.user.openingCashBalance;

  let confirmedReceivables = 0;
  let projectedRecurringIncome = 0;
  let totalExpectedExpenses = 0;

  let lowestBalance = {
    date: todayStr,
    label: formatShortDate(todayStr),
    amount: db.user.openingCashBalance,
  };
  const shortageDates: ShortageDate[] = [];

  for (let day = 0; day <= horizonDays; day++) {
    const dateStr = addDaysISO(todayStr, day);
    const label = formatShortDate(dateStr);

    const confIn = confirmedInflowsByDay.get(day);
    const projIn = projectedInflowsByDay.get(day);
    const out = outflowsByDay.get(day);

    const confInAmount = confIn?.amount ?? 0;
    const projInAmount = projIn?.amount ?? 0;
    const outAmount = out?.amount ?? 0;

    confirmedReceivables += confInAmount;
    projectedRecurringIncome += projInAmount;
    totalExpectedExpenses += outAmount;

    confirmedRunning = confirmedRunning + confInAmount - outAmount;
    projectedRunning = projectedRunning + confInAmount + projInAmount - outAmount;

    const events = [
      ...(confIn?.labels ?? []),
      ...(projIn?.labels ?? []),
      ...(out?.labels ?? []),
    ];

    timeline.push({
      date: dateStr,
      label,
      dayOffset: day,
      confirmedBalance: confirmedRunning,
      projectedBalance: projectedRunning,
      inflow: confInAmount + projInAmount,
      outflow: outAmount,
      events,
    });

    if (projectedRunning < lowestBalance.amount) {
      lowestBalance = { date: dateStr, label, amount: projectedRunning };
    }

    if (projectedRunning < 0) {
      shortageDates.push({
        date: dateStr,
        label,
        projectedBalance: projectedRunning,
        shortfallAmount: Math.abs(projectedRunning),
        cause:
          out?.labels.join(', ') ||
          'Cumulative expense outflows exceed collected cash on hand',
      });
    }
  }

  let healthIndicator: CashFlowForecast['healthIndicator'] = 'Healthy';
  if (shortageDates.length > 0 || lowestBalance.amount < 0) {
    healthIndicator = 'At Risk';
  } else if (lowestBalance.amount < db.user.safetyBufferAmount) {
    healthIndicator = 'Tight';
  }

  return {
    horizonDays,
    currentCash: db.user.openingCashBalance,
    confirmedReceivables,
    projectedRecurringIncome,
    totalExpectedIncome: confirmedReceivables + projectedRecurringIncome,
    totalExpectedExpenses,
    projectedClosingBalance: projectedRunning,
    confirmedClosingBalance: confirmedRunning,
    lowestBalance,
    shortageDates,
    healthIndicator,
    timeline,
  };
}

export function simulateWhatIfScenario(
  db: AppDatabase,
  params: {
    invoiceId: string;
    delayDays: number;
    horizonDays?: 30 | 60 | 90;
    extraMonthlyExpense?: number;
    todayStr?: string;
  }
): SimulationResult {
  const todayStr = params.todayStr ?? getTodayISO();
  const horizonDays = params.horizonDays ?? 30;
  const extraMonthlyExpense = params.extraMonthlyExpense ?? 0;

  const baseline = computeCashFlowForecast(db, {
    horizonDays,
    todayStr,
  });

  const targetInvoice = db.invoices.find((inv) => inv.id === params.invoiceId);
  const student = targetInvoice
    ? db.students.find((s) => s.id === targetInvoice.studentId)
    : undefined;

  const invoiceDateOverrides: Record<string, string> = {};
  if (targetInvoice) {
    const baseExpected =
      diffDaysISO(todayStr, targetInvoice.expectedPaymentDate) >= 1
        ? targetInvoice.expectedPaymentDate
        : addDaysISO(todayStr, 2);
    invoiceDateOverrides[targetInvoice.id] = addDaysISO(baseExpected, params.delayDays);
  }

  const simulated = computeCashFlowForecast(db, {
    horizonDays,
    invoiceDateOverrides,
    extraMonthlyExpense,
    todayStr,
  });

  const baselineShortageSet = new Set(baseline.shortageDates.map((s) => s.date));
  const newlyCreatedShortages = simulated.shortageDates.filter(
    (s) => !baselineShortageSet.has(s.date)
  );

  const closingBalanceDiff =
    simulated.projectedClosingBalance - baseline.projectedClosingBalance;
  const lowestBalanceDiff = simulated.lowestBalance.amount - baseline.lowestBalance.amount;

  const remaining = targetInvoice ? getInvoiceRemaining(targetInvoice) : 0;
  const studentName = student?.fullName ?? 'selected student';
  const newExpectedLabel = targetInvoice
    ? formatShortDate(invoiceDateOverrides[targetInvoice.id])
    : 'later';

  let explanation = '';
  if (!targetInvoice) {
    explanation = 'Select an unpaid or overdue invoice to simulate payment timing impact.';
  } else if (newlyCreatedShortages.length > 0) {
    const firstShortage = newlyCreatedShortages[0];
    explanation = `If ${studentName} delays paying ${formatINR(remaining)} by ${
      params.delayDays
    } days (moving receipt to ${newExpectedLabel}), your cash drops to ${formatINR(
      firstShortage.projectedBalance
    )} on ${firstShortage.label}, creating a new shortfall of ${formatINR(
      firstShortage.shortfallAmount
    )} around ${firstShortage.cause}.`;
  } else if (simulated.lowestBalance.amount < 0) {
    explanation = `Delaying ${studentName}'s ${formatINR(remaining)} payment by ${
      params.delayDays
    } days worsens your projected cash deficit from ${formatINR(
      baseline.lowestBalance.amount
    )} to ${formatINR(simulated.lowestBalance.amount)} on ${
      simulated.lowestBalance.label
    }.`;
  } else if (simulated.lowestBalance.amount < db.user.safetyBufferAmount) {
    explanation = `Delaying ${studentName}'s ${formatINR(remaining)} payment by ${
      params.delayDays
    } days keeps your balance above ₹0, but lowers your minimum buffer to ${formatINR(
      simulated.lowestBalance.amount
    )} on ${simulated.lowestBalance.label} (below your ${formatINR(
      db.user.safetyBufferAmount
    )} safety cushion).`;
  } else {
    explanation = `Your cash cushion absorbs a ${params.delayDays}-day delay from ${studentName} (${formatINR(
      remaining
    )}). Minimum balance stays at ${formatINR(simulated.lowestBalance.amount)} on ${
      simulated.lowestBalance.label
    }.`;
  }

  const suggestedActions: string[] = [];
  if (newlyCreatedShortages.length > 0 && targetInvoice) {
    suggestedActions.push(
      `Send an immediate WhatsApp reminder to ${studentName} to collect at least 50% (${formatINR(
        Math.round(remaining / 2)
      )}) before ${newlyCreatedShortages[0].label}.`
    );
    suggestedActions.push(
      `Follow up on other overdue balances (such as Kabir Malhotra or Sneha Iyer) to bridge the ${formatINR(
        newlyCreatedShortages[0].shortfallAmount
      )} temporary gap.`
    );
    suggestedActions.push(
      `Defer non-urgent material purchases or negotiate a 5-day grace window on discretionary bills.`
    );
  } else if (targetInvoice) {
    suggestedActions.push(
      `Schedule a polite check-in with ${studentName} 3 days before ${newExpectedLabel}.`
    );
    suggestedActions.push(
      `Keep at least ${formatINR(db.user.safetyBufferAmount)} reserve ahead of upcoming monthly rent.`
    );
  }

  const comparisonSeries = baseline.timeline.map((bPt, idx) => ({
    date: bPt.date,
    label: bPt.label,
    baselineBalance: bPt.projectedBalance,
    simulatedBalance: simulated.timeline[idx]?.projectedBalance ?? bPt.projectedBalance,
  }));

  return {
    horizonDays,
    baseline,
    simulated,
    closingBalanceDiff,
    lowestBalanceDiff,
    newlyCreatedShortages,
    explanation,
    suggestedActions,
    comparisonSeries,
  };
}

export function generateActionCenterItems(
  db: AppDatabase,
  todayStr = getTodayISO()
): ActionItem[] {
  const items: ActionItem[] = [];
  const studentMap = new Map(db.students.map((s) => [s.id, s]));

  // 1. Overdue and Due Soon Invoices
  for (const inv of db.invoices) {
    const status = deriveInvoiceStatus(inv, todayStr);
    const remaining = getInvoiceRemaining(inv);
    const student = studentMap.get(inv.studentId);
    const studentName = student?.fullName ?? 'Student';

    if (status === 'Overdue' && remaining > 0) {
      const daysOverdue = getOverdueDays(inv.dueDate, todayStr);
      items.push({
        id: `act-inv-${inv.id}`,
        priority: daysOverdue >= 10 ? 'Critical' : 'High',
        category: inv.paidAmount > 0 ? 'partial_followup' : 'overdue_invoice',
        title: `${studentName}: ${formatINR(remaining)} overdue by ${daysOverdue} day${
          daysOverdue === 1 ? '' : 's'
        }`,
        reason:
          inv.paidAmount > 0
            ? `Partial payment of ${formatINR(inv.paidAmount)} received on ${
                inv.invoiceNumber
              }; remaining ${formatINR(remaining)} is past due.`
            : `Invoice ${inv.invoiceNumber} for ${inv.description} was due on ${formatFullDate(
                inv.dueDate
              )}.`,
        amount: remaining,
        deadline: inv.dueDate,
        daysDelta: -daysOverdue,
        recommendedAction: 'Send AI-personalized WhatsApp or email payment reminder today.',
        actionLabel: 'Send reminder',
        targetView: 'invoices',
        targetId: inv.id,
      });
    } else if ((status === 'Unpaid' || status === 'Partially Paid') && remaining > 0) {
      const daysUntil = diffDaysISO(todayStr, inv.dueDate);
      if (daysUntil >= 0 && daysUntil <= 5) {
        items.push({
          id: `act-due-${inv.id}`,
          priority: daysUntil <= 1 ? 'High' : 'Medium',
          category: 'due_soon',
          title: `${studentName}: ${formatINR(remaining)} due ${
            daysUntil === 0
              ? 'today'
              : daysUntil === 1
                ? 'tomorrow'
                : `in ${daysUntil} days`
          }`,
          reason: `Proactive reminder before ${formatFullDate(
            inv.dueDate
          )} improves on-time UPI collection.`,
          amount: remaining,
          deadline: inv.dueDate,
          daysDelta: daysUntil,
          recommendedAction: 'Prepare and send a friendly pre-due reminder.',
          actionLabel: 'Prepare reminder',
          targetView: 'invoices',
          targetId: inv.id,
        });
      }
    } else if (status === 'Draft') {
      items.push({
        id: `act-draft-${inv.id}`,
        priority: 'Low',
        category: 'draft_invoice',
        title: `Finalize draft invoice for ${studentName} (${formatINR(inv.totalAmount)})`,
        reason: `Invoice ${inv.invoiceNumber} is saved as Draft and has not been issued yet.`,
        amount: inv.totalAmount,
        deadline: inv.dueDate,
        daysDelta: diffDaysISO(todayStr, inv.dueDate),
        recommendedAction: 'Review line items and issue invoice to start payment tracking.',
        actionLabel: 'Review invoice',
        targetView: 'invoices',
        targetId: inv.id,
      });
    }
  }

  // 2. Upcoming Expenses within 10 days
  for (const exp of db.expenses) {
    if (exp.status === 'Paid') continue;
    const daysUntil = diffDaysISO(todayStr, exp.dueDate);
    if (daysUntil <= 10) {
      items.push({
        id: `act-exp-${exp.id}`,
        priority: daysUntil <= 4 ? 'High' : 'Medium',
        category: 'upcoming_expense',
        title: `${exp.title}: ${formatINR(exp.amount)} ${
          daysUntil < 0
            ? `overdue by ${Math.abs(daysUntil)} days`
            : daysUntil === 0
              ? 'due today'
              : `due in ${daysUntil} days`
        }`,
        reason: `${exp.category} expense${exp.vendor ? ` (${exp.vendor})` : ''} scheduled for ${formatFullDate(
          exp.dueDate
        )}.`,
        amount: exp.amount,
        deadline: exp.dueDate,
        daysDelta: daysUntil,
        recommendedAction: 'Plan cash availability and record payment once settled.',
        actionLabel: 'Plan cash',
        targetView: 'expenses',
        targetId: exp.id,
      });
    }
  }

  // 3. Cash Forecast Shortage / Tight Buffer Alert
  const forecast30 = computeCashFlowForecast(db, { horizonDays: 30, todayStr });
  if (forecast30.shortageDates.length > 0) {
    const first = forecast30.shortageDates[0];
    items.push({
      id: 'act-cash-shortage',
      priority: 'Critical',
      category: 'cash_shortage',
      title: `Cash shortfall of ${formatINR(first.shortfallAmount)} projected on ${first.label}`,
      reason: `Projected balance dips to ${formatINR(first.projectedBalance)} due to ${first.cause}.`,
      amount: first.shortfallAmount,
      deadline: first.date,
      daysDelta: diffDaysISO(todayStr, first.date),
      recommendedAction: 'Accelerate overdue invoice collections or simulate payment timing.',
      actionLabel: 'Inspect forecast',
      targetView: 'forecast',
      targetId: first.date,
    });
  } else if (forecast30.lowestBalance.amount < db.user.safetyBufferAmount) {
    items.push({
      id: 'act-cash-tight',
      priority: 'Medium',
      category: 'cash_shortage',
      title: `Cash buffer narrows to ${formatINR(forecast30.lowestBalance.amount)} on ${
        forecast30.lowestBalance.label
      }`,
      reason: `Projected minimum balance falls below your ${formatINR(
        db.user.safetyBufferAmount
      )} target cushion. Any 15-day delay on major fees could cause a deficit.`,
      amount: forecast30.lowestBalance.amount,
      deadline: forecast30.lowestBalance.date,
      daysDelta: diffDaysISO(todayStr, forecast30.lowestBalance.date),
      recommendedAction: 'Test a 15-day delay in What-If Simulator and prioritize overdue follow-ups.',
      actionLabel: 'Simulate delay',
      targetView: 'simulator',
      targetId: 'inv-cur-4',
    });
  }

  const priorityOrder: Record<ActionItem['priority'], number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return items.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.daysDelta - b.daysDelta;
  });
}

export function buildTemplateReminder(params: {
  studentName: string;
  amount: number;
  overdueDays: number;
  dueDate: string;
  invoiceNumber: string;
  upiId: string;
  tone: 'polite' | 'friendly_whatsapp' | 'professional' | 'firm';
  language: 'English' | 'Hindi';
  isPartial?: boolean;
}): string {
  const amt = formatINR(params.amount);
  const due = formatFullDate(params.dueDate);
  const firstName = params.studentName.split(' ')[0];

  if (params.language === 'Hindi') {
    if (params.tone === 'friendly_whatsapp') {
      return `नमस्ते ${firstName} जी, आशा है पढ़ाई अच्छी चल रही होगी! आपकी ${
        params.isPartial ? 'बकाया ' : ''
      }ट्यूशन फीस ${amt} (इनवॉइस ${params.invoiceNumber}, अंतिम तिथि ${due}) अभी लंबित है। कृपया सुविधा अनुसार UPI (${params.upiId}) द्वारा भुगतान कर दें। धन्यवाद!`;
    }
    if (params.tone === 'professional') {
      return `प्रिय अभिभावक / ${params.studentName}, यह सूचित किया जाता है कि इनवॉइस ${params.invoiceNumber} की ${amt} राशि ${
        params.overdueDays > 0 ? `${params.overdueDays} दिनों से लंबित है` : `अंतिम तिथि ${due} तक देय है`
      }। कृपया शीघ्र भुगतान कर रसीद साझा करें। UPI: ${params.upiId}। सादर, ट्यूटर डेस्क।`;
    }
    if (params.tone === 'firm') {
      return `नमस्ते ${params.studentName}, आपकी ${amt} की ट्यूशन फीस ${
        params.overdueDays > 0 ? `${params.overdueDays} दिनों से बकाया है` : `${due} तक देय है`
      }। कक्षा संचालन को सुचारू रखने के लिए कृपया आज ही UPI (${params.upiId}) पर भुगतान पूरा करें।`;
    }
    return `नमस्ते ${firstName} जी, यह एक विनम्र अनुस्मारक है कि आपकी ${amt} की ट्यूशन फीस (${params.invoiceNumber}) अभी शेष है। कृपया अपनी सुविधा से भुगतान कर दें। धन्यवाद!`;
  }

  if (params.tone === 'friendly_whatsapp') {
    return `Hi ${firstName}! Hope classes are going well. Just a quick friendly reminder that your ${
      params.isPartial ? 'remaining ' : ''
    }tuition fee of ${amt} (${params.invoiceNumber}, due ${due}) is still pending. You can pay easily via UPI at ${params.upiId}. Thanks so much!`;
  }
  if (params.tone === 'professional') {
    return `Dear ${params.studentName} / Parent, this is a payment reminder for Invoice ${params.invoiceNumber} amounting to ${amt}, ${
      params.overdueDays > 0
        ? `which is currently overdue by ${params.overdueDays} days (due date: ${due})`
        : `due on ${due}`
    }. Kindly remit the payment via UPI (${params.upiId}) or bank transfer and share the reference.`;
  }
  if (params.tone === 'firm') {
    return `Hello ${params.studentName}, your tuition balance of ${amt} for Invoice ${params.invoiceNumber} is now ${
      params.overdueDays > 0 ? `${params.overdueDays} days overdue` : `due on ${due}`
    }. Please settle this balance today via UPI (${params.upiId}) to avoid disruption to scheduled sessions. Thank you for your prompt attention.`;
  }
  return `Hello ${firstName}, this is a gentle reminder that your tuition fee of ${amt} (${params.invoiceNumber}, due ${due}) is still pending. Kindly complete the payment at your convenience via UPI (${params.upiId}). Thank you!`;
}
