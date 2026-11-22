import { GoogleGenAI } from '@google/genai';
import type {
  AppDatabase,
  Invoice,
  Reminder,
  ReminderLanguage,
  ReminderTone,
  Student,
} from '../src/types/finance.ts';
import {
  buildTemplateReminder,
  computeCashFlowForecast,
  computeDashboardSummary,
  computeStudentMetrics,
  deriveInvoiceStatus,
  formatFullDate,
  formatINR,
  generateActionCenterItems,
  getInvoiceRemaining,
  getOverdueDays,
  getTodayISO,
  simulateWhatIfScenario,
} from '../src/services/financeEngine.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function generateReminderWithAI(params: {
  db: AppDatabase;
  invoice: Invoice;
  student: Student;
  tone: ReminderTone;
  language: ReminderLanguage;
  history: Reminder[];
}): Promise<{ message: string; source: 'gemini' | 'template' }> {
  const todayStr = getTodayISO();
  const remaining = getInvoiceRemaining(params.invoice);
  const overdueDays = getOverdueDays(params.invoice.dueDate, todayStr);
  const isPartial = params.invoice.paidAmount > 0 && remaining > 0;

  const fallbackMessage = buildTemplateReminder({
    studentName: params.student.fullName,
    amount: remaining,
    overdueDays,
    dueDate: params.invoice.dueDate,
    invoiceNumber: params.invoice.invoiceNumber,
    upiId: params.db.user.upiId,
    tone: params.tone,
    language: params.language,
    isPartial,
  });

  const ai = getGeminiClient();
  if (!ai) {
    return { message: fallbackMessage, source: 'template' };
  }

  const toneDescriptions: Record<ReminderTone, string> = {
    polite: 'Polite, warm, and respectful',
    friendly_whatsapp: 'Conversational, warm, concise WhatsApp-ready message',
    professional: 'Formal, clear, business-like invoice notice',
    firm: 'Firm, clear, respectful urgency without being rude',
  };

  const historySummary =
    params.history.length > 0
      ? params.history
          .slice(0, 3)
          .map(
            (r) =>
              `- ${r.createdAt.slice(0, 10)} (${r.tone}, ${r.language}): "${r.message.slice(0, 80)}..."`
          )
          .join('\n')
      : 'No prior reminders sent for this invoice.';

  const prompt = `Draft a payment reminder message for an independent tutor in India.

Facts (use these exact figures — do not invent anything):
- Tutor/Studio: ${params.db.user.businessName} (${params.db.user.name})
- UPI ID: ${params.db.user.upiId}
- Student Name: ${params.student.fullName}
- Subject/Grade: ${params.student.subject} (${params.student.grade})
- Invoice Number: ${params.invoice.invoiceNumber}
- Total Invoice: ${formatINR(params.invoice.totalAmount)}
- Already Paid: ${formatINR(params.invoice.paidAmount)}
- Remaining Amount Due: ${formatINR(remaining)}
- Due Date: ${formatFullDate(params.invoice.dueDate)}
- Overdue Days: ${overdueDays > 0 ? `${overdueDays} days overdue` : 'Not yet overdue'}
- Tone: ${toneDescriptions[params.tone]}
- Language: ${params.language} (${
    params.language === 'Hindi' ? 'Write naturally in Devanagari Hindi' : 'Write in clear Indian English'
  })

Previous reminder history:
${historySummary}

Requirements:
- Return ONLY the ready-to-send message text (no quotes, no subject line, no preamble).
- Keep it concise (2 to 4 sentences).
- Mention the exact remaining INR amount (${formatINR(remaining)}) and UPI ID (${params.db.user.upiId}).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You write concise, culturally appropriate fee reminder messages for independent tutors in India. Never fabricate numbers or claim a message was sent.',
      },
    });
    const text = response.text?.trim();
    if (text && text.length > 15) {
      return { message: text, source: 'gemini' };
    }
  } catch (err) {
    console.warn('Gemini reminder fallback triggered:', err instanceof Error ? err.message : err);
  }

  return { message: fallbackMessage, source: 'template' };
}

function buildGroundedContextSnapshot(db: AppDatabase) {
  const todayStr = getTodayISO();
  const summary = computeDashboardSummary(db, todayStr);
  const students = computeStudentMetrics(db, todayStr);
  const forecast30 = computeCashFlowForecast(db, { horizonDays: 30, todayStr });
  const forecast60 = computeCashFlowForecast(db, { horizonDays: 60, todayStr });
  const forecast90 = computeCashFlowForecast(db, { horizonDays: 90, todayStr });
  const actions = generateActionCenterItems(db, todayStr);

  const unpaidInvoices = db.invoices
    .filter((inv) => inv.status !== 'Draft' && getInvoiceRemaining(inv) > 0)
    .map((inv) => {
      const stu = db.students.find((s) => s.id === inv.studentId);
      const status = deriveInvoiceStatus(inv, todayStr);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        studentName: stu?.fullName ?? 'Unknown',
        remaining: getInvoiceRemaining(inv),
        paidAmount: inv.paidAmount,
        dueDate: inv.dueDate,
        expectedPaymentDate: inv.expectedPaymentDate,
        status,
        overdueDays: getOverdueDays(inv.dueDate, todayStr),
      };
    });

  const upcomingExpenses = db.expenses
    .filter((e) => e.status !== 'Paid')
    .map((e) => ({
      title: e.title,
      category: e.category,
      amount: e.amount,
      dueDate: e.dueDate,
      isRecurring: e.isRecurring,
    }));

  // Precompute 15-day delay on top overdue invoice for instant grounded reference
  const topOverdue = unpaidInvoices.sort((a, b) => b.overdueDays - a.overdueDays)[0];
  const sampleDelaySim = topOverdue
    ? simulateWhatIfScenario(db, {
        invoiceId: topOverdue.id,
        delayDays: 15,
        horizonDays: 30,
        todayStr,
      })
    : null;

  return {
    todayStr,
    summary,
    students,
    unpaidInvoices,
    upcomingExpenses,
    forecast30,
    forecast60,
    forecast90,
    actions,
    sampleDelaySim,
    topOverdue,
  };
}

function deterministicCopilotReply(question: string, db: AppDatabase): string {
  const q = question.toLowerCase();
  const ctx = buildGroundedContextSnapshot(db);

  // Check affordability question (e.g. "afford a new monthly expense of ₹5,000")
  const affordMatch = q.match(/(?:afford|new.*expense|add.*expense).*?(\d[\d,]*)/i);
  if (affordMatch || q.includes('afford')) {
    const rawNum = affordMatch ? Number(affordMatch[1].replace(/,/g, '')) : 5000;
    const testAmt = Number.isFinite(rawNum) && rawNum > 0 ? rawNum : 5000;
    const simWithExpense = computeCashFlowForecast(db, {
      horizonDays: 30,
      extraMonthlyExpense: testAmt,
      todayStr: ctx.todayStr,
    });
    const f60WithExpense = computeCashFlowForecast(db, {
      horizonDays: 60,
      extraMonthlyExpense: testAmt,
      todayStr: ctx.todayStr,
    });
    if (simWithExpense.shortageDates.length > 0) {
      const first = simWithExpense.shortageDates[0];
      return `Adding a new monthly expense of ${formatINR(
        testAmt
      )} would create a cash shortfall of ${formatINR(first.shortfallAmount)} on ${
        first.label
      } (minimum balance ${formatINR(
        simWithExpense.lowestBalance.amount
      )}). With current cash at ${formatINR(
        ctx.summary.availableCash
      )}, you should first collect your ${formatINR(
        ctx.summary.overduePayments
      )} in overdue fees before committing to this recurring cost.`;
    }
    return `Your 30-day minimum cash balance after adding ${formatINR(
      testAmt
    )}/month is ${formatINR(simWithExpense.lowestBalance.amount)} (on ${
      simWithExpense.lowestBalance.label
    }), and your 60-day closing balance is ${formatINR(
      f60WithExpense.projectedClosingBalance
    )}. ${
      simWithExpense.lowestBalance.amount < db.user.safetyBufferAmount
        ? `It stays positive, but dips below your ${formatINR(
            db.user.safetyBufferAmount
          )} safety buffer — so only add it once overdue fees are collected.`
        : 'Yes, it fits within your cash buffer based on scheduled collections.'
    }`;
  }

  // Check delay / late simulation
  if (q.includes('late') || q.includes('delay') || q.includes('rahul')) {
    const matchedStudentInv = ctx.unpaidInvoices.find((inv) =>
      q.includes(inv.studentName.split(' ')[0].toLowerCase())
    );
    const target = matchedStudentInv ?? ctx.topOverdue;
    if (!target) {
      return 'There are currently no unpaid invoices to simulate a delay against.';
    }
    const dayMatch = q.match(/(\d+)\s*day/);
    const delayDays = dayMatch ? Math.min(60, Math.max(1, Number(dayMatch[1]))) : 15;
    const sim = simulateWhatIfScenario(db, {
      invoiceId: target.id,
      delayDays,
      horizonDays: 30,
      todayStr: ctx.todayStr,
    });
    return `${sim.explanation}\n\nRecommended step: ${
      sim.suggestedActions[0] ?? 'Follow up early via WhatsApp.'
    }`;
  }

  // Check pending / unpaid / who owes
  if (
    q.includes('pending') ||
    q.includes('owe') ||
    q.includes('not paid') ||
    q.includes('unpaid') ||
    q.includes('overdue')
  ) {
    if (ctx.unpaidInvoices.length === 0) {
      return 'All issued invoices are currently paid in full!';
    }
    const lines = ctx.unpaidInvoices
      .sort((a, b) => b.overdueDays - a.overdueDays)
      .map(
        (i) =>
          `• ${i.studentName}: ${formatINR(i.remaining)} (${
            i.overdueDays > 0
              ? `overdue by ${i.overdueDays} days`
              : `due ${formatFullDate(i.dueDate)}`
          })`
      )
      .join('\n');
    return `You have ${formatINR(ctx.summary.outstandingPayments)} pending across ${
      ctx.unpaidInvoices.length
    } invoices (${formatINR(ctx.summary.overduePayments)} overdue):\n${lines}`;
  }

  // Check chase today / priorities
  if (q.includes('chase') || q.includes('today') || q.includes('priority') || q.includes('follow')) {
    const top = ctx.actions.slice(0, 4);
    if (top.length === 0) {
      return 'You have no urgent overdue items or upcoming bill crunches today.';
    }
    return (
      `Here are your top priorities today:\n` +
      top.map((a, idx) => `${idx + 1}. [${a.priority}] ${a.title} — ${a.recommendedAction}`).join('\n')
    );
  }

  // Check cash balance / forecast / next month
  if (
    q.includes('cash') ||
    q.includes('forecast') ||
    q.includes('next month') ||
    q.includes('30') ||
    q.includes('60') ||
    q.includes('90') ||
    q.includes('balance')
  ) {
    return (
      `Current available cash: ${formatINR(ctx.summary.availableCash)}.\n` +
      `• 30-Day Forecast: Closing ${formatINR(
        ctx.forecast30.projectedClosingBalance
      )} (Income ${formatINR(ctx.forecast30.totalExpectedIncome)} vs Expenses ${formatINR(
        ctx.forecast30.totalExpectedExpenses
      )}, Low point ${formatINR(ctx.forecast30.lowestBalance.amount)} on ${
        ctx.forecast30.lowestBalance.label
      }, Status: ${ctx.forecast30.healthIndicator}).\n` +
      `• 60-Day Closing: ${formatINR(ctx.forecast60.projectedClosingBalance)} | 90-Day Closing: ${formatINR(
        ctx.forecast90.projectedClosingBalance
      )}.`
    );
  }

  // Default executive snapshot
  return (
    `Here is your live TutorFlow AI snapshot:\n` +
    `• Available Cash: ${formatINR(ctx.summary.availableCash)} | Outstanding Fees: ${formatINR(
      ctx.summary.outstandingPayments
    )} (${formatINR(ctx.summary.overduePayments)} overdue)\n` +
    `• 30-Day Closing Cash: ${formatINR(ctx.forecast30.projectedClosingBalance)} (${
      ctx.forecast30.healthIndicator
    })\n` +
    `• Top Priority: ${ctx.actions[0]?.title ?? 'All invoices on track'}.`
  );
}

export async function askCopilotWithAI(params: {
  db: AppDatabase;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ answer: string; source: 'gemini' | 'grounded-engine' }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      answer: deterministicCopilotReply(params.question, params.db),
      source: 'grounded-engine',
    };
  }

  const ctx = buildGroundedContextSnapshot(params.db);
  const compactData = {
    today: ctx.todayStr,
    currency: 'INR',
    availableCash: ctx.summary.availableCash,
    safetyBuffer: params.db.user.safetyBufferAmount,
    totalRevenue: ctx.summary.totalRevenue,
    collectedPayments: ctx.summary.collectedPayments,
    outstandingPayments: ctx.summary.outstandingPayments,
    overduePayments: ctx.summary.overduePayments,
    monthlyExpenses: ctx.summary.monthlyExpenses,
    unpaidInvoices: ctx.unpaidInvoices,
    upcomingExpenses: ctx.upcomingExpenses,
    forecasts: {
      days30: {
        expectedIncome: ctx.forecast30.totalExpectedIncome,
        confirmedReceivables: ctx.forecast30.confirmedReceivables,
        projectedRecurring: ctx.forecast30.projectedRecurringIncome,
        expectedExpenses: ctx.forecast30.totalExpectedExpenses,
        closingBalance: ctx.forecast30.projectedClosingBalance,
        lowestBalance: ctx.forecast30.lowestBalance,
        shortageDates: ctx.forecast30.shortageDates,
        health: ctx.forecast30.healthIndicator,
      },
      days60Closing: ctx.forecast60.projectedClosingBalance,
      days90Closing: ctx.forecast90.projectedClosingBalance,
    },
    topActions: ctx.actions.slice(0, 5),
    whatIf15DayDelayOnTopOverdue: ctx.sampleDelaySim
      ? {
          invoice: ctx.topOverdue?.invoiceNumber,
          student: ctx.topOverdue?.studentName,
          baselineLowest: ctx.sampleDelaySim.baseline.lowestBalance,
          simulatedLowest: ctx.sampleDelaySim.simulated.lowestBalance,
          newlyCreatedShortages: ctx.sampleDelaySim.newlyCreatedShortages,
          explanation: ctx.sampleDelaySim.explanation,
        }
      : null,
  };

  const recentTurns = (params.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Tutor' : 'Copilot'}: ${m.content}`)
    .join('\n');

  const prompt = `Live Financial Data (JSON):
${JSON.stringify(compactData, null, 2)}

${recentTurns ? `Recent Conversation:\n${recentTurns}\n\n` : ''}Tutor's Question: ${params.question}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are TutorFlow Copilot, a sharp, plain-English financial assistant for an independent Indian tutor. Answer strictly using the Live Financial Data JSON provided. Never invent or hallucinate any INR amounts, student names, or dates. If a detail is missing from the JSON, state clearly what is missing. Keep answers concise, structured with short bullet points, and actionable.',
      },
    });
    const text = response.text?.trim();
    if (text) {
      return { answer: text, source: 'gemini' };
    }
  } catch (err) {
    console.warn('Gemini copilot fallback triggered:', err instanceof Error ? err.message : err);
  }

  return {
    answer: deterministicCopilotReply(params.question, params.db),
    source: 'grounded-engine',
  };
}

export async function generateHealthSummaryWithAI(
  db: AppDatabase
): Promise<{ summaryText: string; source: 'gemini' | 'grounded-engine' }> {
  const ctx = buildGroundedContextSnapshot(db);
  const fallback = `You currently hold ${formatINR(
    ctx.summary.availableCash
  )} in available cash with ${formatINR(
    ctx.summary.outstandingPayments
  )} pending (${formatINR(ctx.summary.overduePayments)} overdue across ${
    ctx.summary.overdueInvoiceCount
  } invoices). Your 30-day cash outlook is ${ctx.forecast30.healthIndicator} with a projected low of ${formatINR(
    ctx.forecast30.lowestBalance.amount
  )} on ${ctx.forecast30.lowestBalance.label}. Collecting ${
    ctx.topOverdue?.studentName ?? 'overdue fees'
  } before monthly rent due in 4 days protects your buffer.`;

  const ai = getGeminiClient();
  if (!ai) {
    return { summaryText: fallback, source: 'grounded-engine' };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Write a concise 2-sentence financial health summary for this tutor using ONLY these exact numbers:
- Available cash: ${formatINR(ctx.summary.availableCash)}
- Collected this cycle: ${formatINR(ctx.summary.collectedPayments)}
- Outstanding: ${formatINR(ctx.summary.outstandingPayments)} (${formatINR(
        ctx.summary.overduePayments
      )} overdue across ${ctx.summary.overdueInvoiceCount} invoices)
- 30-day forecast health: ${ctx.forecast30.healthIndicator}, lowest balance ${formatINR(
        ctx.forecast30.lowestBalance.amount
      )} on ${ctx.forecast30.lowestBalance.label}, closing ${formatINR(
        ctx.forecast30.projectedClosingBalance
      )}
- Top action: ${ctx.actions[0]?.title ?? 'None'}`,
      config: {
        systemInstruction:
          'Be direct, plain-spoken, and specific with INR numbers. Maximum 2 sentences. No filler.',
      },
    });
    const text = response.text?.trim();
    if (text) {
      return { summaryText: text, source: 'gemini' };
    }
  } catch (err) {
    console.warn('Gemini health summary fallback:', err instanceof Error ? err.message : err);
  }

  return { summaryText: fallback, source: 'grounded-engine' };
}
