import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AppDatabase,
  Expense,
  Invoice,
  Payment,
  Reminder,
  ReminderLanguage,
  ReminderTone,
  Scenario,
  Student,
} from './src/types/finance.ts';
import { createDemoDatabase } from './src/services/seedData.ts';
import { deriveInvoiceStatus, getTodayISO } from './src/services/financeEngine.ts';
import {
  askCopilotWithAI,
  generateHealthSummaryWithAI,
  generateReminderWithAI,
} from './server/ai.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'tutorflow-db.json');

function ensureDbDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDatabase(): AppDatabase {
  ensureDbDir();
  if (!fs.existsSync(DB_FILE)) {
    const seed = createDemoDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AppDatabase;
    if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.invoices)) {
      throw new Error('Corrupt DB structure');
    }
    return parsed;
  } catch {
    const seed = createDemoDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function saveDatabase(db: AppDatabase): void {
  ensureDbDir();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizePositiveNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function sanitizeDateString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return fallback;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Full application state
  app.get('/api/state', (_req, res) => {
    const db = loadDatabase();
    const today = getTodayISO();
    // Keep derived invoice statuses fresh on read
    db.invoices = db.invoices.map((inv) => ({
      ...inv,
      status: deriveInvoiceStatus(inv, today),
    }));
    res.json(db);
  });

  // Reset demo dataset
  app.post('/api/reset-demo', (_req, res) => {
    const seed = createDemoDatabase();
    saveDatabase(seed);
    res.json(seed);
  });

  // Update tutor profile / forecast assumptions / cash balance
  app.put('/api/settings', (req, res) => {
    const db = loadDatabase();
    const body = req.body ?? {};
    db.user = {
      ...db.user,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : db.user.name,
      businessName:
        typeof body.businessName === 'string' && body.businessName.trim()
          ? body.businessName.trim()
          : db.user.businessName,
      email: typeof body.email === 'string' ? body.email.trim() : db.user.email,
      phone: typeof body.phone === 'string' ? body.phone.trim() : db.user.phone,
      upiId: typeof body.upiId === 'string' && body.upiId.trim() ? body.upiId.trim() : db.user.upiId,
      openingCashBalance:
        body.openingCashBalance !== undefined
          ? Number(body.openingCashBalance) || 0
          : db.user.openingCashBalance,
      collectionAssumptionPercent:
        body.collectionAssumptionPercent !== undefined
          ? Math.min(100, Math.max(20, Number(body.collectionAssumptionPercent) || 100))
          : db.user.collectionAssumptionPercent,
      includeRecurringTuitionInForecast:
        typeof body.includeRecurringTuitionInForecast === 'boolean'
          ? body.includeRecurringTuitionInForecast
          : db.user.includeRecurringTuitionInForecast,
      safetyBufferAmount:
        body.safetyBufferAmount !== undefined
          ? sanitizePositiveNumber(body.safetyBufferAmount, db.user.safetyBufferAmount)
          : db.user.safetyBufferAmount,
    };
    saveDatabase(db);
    res.json(db.user);
  });

  // Students CRUD
  app.post('/api/students', (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    if (typeof b.fullName !== 'string' || !b.fullName.trim()) {
      res.status(400).json({ error: 'Student full name is required.' });
      return;
    }
    const today = getTodayISO();
    const student: Student = {
      id: makeId('stu'),
      fullName: b.fullName.trim(),
      phone: typeof b.phone === 'string' ? b.phone.trim() : '',
      email: typeof b.email === 'string' && b.email.trim() ? b.email.trim() : undefined,
      grade: typeof b.grade === 'string' && b.grade.trim() ? b.grade.trim() : 'Class 10',
      subject: typeof b.subject === 'string' && b.subject.trim() ? b.subject.trim() : 'Mathematics',
      monthlyFee: sanitizePositiveNumber(b.monthlyFee, 3000),
      joiningDate: sanitizeDateString(b.joiningDate, today),
      paymentDueDay: Math.min(28, Math.max(1, Number(b.paymentDueDay) || 5)),
      status: b.status === 'paused' ? 'paused' : 'active',
      notes: typeof b.notes === 'string' ? b.notes.trim() : '',
      isDemo: false,
    };
    db.students.unshift(student);
    saveDatabase(db);
    res.status(201).json(student);
  });

  app.put('/api/students/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.students.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const b = req.body ?? {};
    const existing = db.students[idx];
    const updated: Student = {
      ...existing,
      fullName:
        typeof b.fullName === 'string' && b.fullName.trim() ? b.fullName.trim() : existing.fullName,
      phone: typeof b.phone === 'string' ? b.phone.trim() : existing.phone,
      email: typeof b.email === 'string' ? b.email.trim() || undefined : existing.email,
      grade: typeof b.grade === 'string' && b.grade.trim() ? b.grade.trim() : existing.grade,
      subject: typeof b.subject === 'string' && b.subject.trim() ? b.subject.trim() : existing.subject,
      monthlyFee:
        b.monthlyFee !== undefined
          ? sanitizePositiveNumber(b.monthlyFee, existing.monthlyFee)
          : existing.monthlyFee,
      joiningDate: sanitizeDateString(b.joiningDate, existing.joiningDate),
      paymentDueDay:
        b.paymentDueDay !== undefined
          ? Math.min(28, Math.max(1, Number(b.paymentDueDay) || existing.paymentDueDay))
          : existing.paymentDueDay,
      status: b.status === 'paused' ? 'paused' : b.status === 'active' ? 'active' : existing.status,
      notes: typeof b.notes === 'string' ? b.notes.trim() : existing.notes,
    };
    db.students[idx] = updated;
    saveDatabase(db);
    res.json(updated);
  });

  app.delete('/api/students/:id', (req, res) => {
    const db = loadDatabase();
    const exists = db.students.some((s) => s.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    db.students = db.students.filter((s) => s.id !== req.params.id);
    db.invoices = db.invoices.filter((i) => i.studentId !== req.params.id);
    db.payments = db.payments.filter((p) => p.studentId !== req.params.id);
    db.reminders = db.reminders.filter((r) => r.studentId !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // Invoices CRUD
  app.post('/api/invoices', (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    const student = db.students.find((s) => s.id === b.studentId);
    if (!student) {
      res.status(400).json({ error: 'Valid studentId is required.' });
      return;
    }
    const today = getTodayISO();
    const amount = sanitizePositiveNumber(b.amount, student.monthlyFee);
    const discount = Math.min(amount, sanitizePositiveNumber(b.discount, 0));
    const totalAmount = Math.max(0, amount - discount);
    const nextNum = 117 + db.invoices.length;
    const invoiceNumber =
      typeof b.invoiceNumber === 'string' && b.invoiceNumber.trim()
        ? b.invoiceNumber.trim()
        : `INV-${new Date().getFullYear()}-${nextNum}`;
    const dueDate = sanitizeDateString(b.dueDate, today);

    const draftStatus = b.status === 'Draft' ? 'Draft' : 'Unpaid';
    const newInvoice: Invoice = {
      id: makeId('inv'),
      invoiceNumber,
      studentId: student.id,
      issueDate: sanitizeDateString(b.issueDate, today),
      dueDate,
      expectedPaymentDate: sanitizeDateString(b.expectedPaymentDate, dueDate),
      description:
        typeof b.description === 'string' && b.description.trim()
          ? b.description.trim()
          : `${student.subject} Tuition Fee`,
      billingMonth:
        typeof b.billingMonth === 'string' && b.billingMonth.trim()
          ? b.billingMonth.trim()
          : new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      amount,
      discount,
      totalAmount,
      paidAmount: 0,
      status: draftStatus,
      isRecurring: Boolean(b.isRecurring ?? true),
      isDemo: false,
    };
    newInvoice.status = deriveInvoiceStatus(newInvoice, today);
    db.invoices.unshift(newInvoice);
    saveDatabase(db);
    res.status(201).json(newInvoice);
  });

  app.put('/api/invoices/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.invoices.findIndex((i) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const b = req.body ?? {};
    const existing = db.invoices[idx];
    const today = getTodayISO();
    const amount =
      b.amount !== undefined ? sanitizePositiveNumber(b.amount, existing.amount) : existing.amount;
    const discount =
      b.discount !== undefined
        ? Math.min(amount, sanitizePositiveNumber(b.discount, existing.discount))
        : existing.discount;
    const totalAmount = Math.max(0, amount - discount);
    const dueDate = sanitizeDateString(b.dueDate, existing.dueDate);

    const updated: Invoice = {
      ...existing,
      studentId: typeof b.studentId === 'string' ? b.studentId : existing.studentId,
      issueDate: sanitizeDateString(b.issueDate, existing.issueDate),
      dueDate,
      expectedPaymentDate: sanitizeDateString(b.expectedPaymentDate, dueDate),
      description:
        typeof b.description === 'string' && b.description.trim()
          ? b.description.trim()
          : existing.description,
      amount,
      discount,
      totalAmount,
      status: b.status === 'Draft' ? 'Draft' : b.status === 'Unpaid' ? 'Unpaid' : existing.status,
    };
    updated.status = deriveInvoiceStatus(updated, today);
    db.invoices[idx] = updated;
    saveDatabase(db);
    res.json(updated);
  });

  app.delete('/api/invoices/:id', (req, res) => {
    const db = loadDatabase();
    const exists = db.invoices.some((i) => i.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    db.invoices = db.invoices.filter((i) => i.id !== req.params.id);
    db.payments = db.payments.filter((p) => p.invoiceId !== req.params.id);
    db.reminders = db.reminders.filter((r) => r.invoiceId !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // Record payment (full or partial) -> updates invoice paidAmount, status & cash on hand
  app.post('/api/payments', (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    const invIdx = db.invoices.findIndex((i) => i.id === b.invoiceId);
    if (invIdx === -1) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const invoice = db.invoices[invIdx];
    const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    if (remaining <= 0) {
      res.status(400).json({ error: 'Invoice is already fully paid.' });
      return;
    }
    const rawAmount = sanitizePositiveNumber(b.amount, remaining);
    const appliedAmount = Math.min(remaining, rawAmount);
    if (appliedAmount <= 0) {
      res.status(400).json({ error: 'Payment amount must be greater than zero.' });
      return;
    }

    const today = getTodayISO();
    const payment: Payment = {
      id: makeId('pay'),
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      amount: appliedAmount,
      date: sanitizeDateString(b.date, today),
      method:
        b.method === 'Bank Transfer' || b.method === 'Cash' || b.method === 'Card'
          ? b.method
          : 'UPI',
      reference:
        typeof b.reference === 'string' && b.reference.trim()
          ? b.reference.trim()
          : `UPI-${Math.floor(100000000 + Math.random() * 899999999)}`,
      notes: typeof b.notes === 'string' ? b.notes.trim() : undefined,
      isDemo: false,
    };

    const updatedInvoice: Invoice = {
      ...invoice,
      paidAmount: invoice.paidAmount + appliedAmount,
      status: invoice.status === 'Draft' ? 'Unpaid' : invoice.status,
    };
    updatedInvoice.status = deriveInvoiceStatus(updatedInvoice, today);

    db.payments.unshift(payment);
    db.invoices[invIdx] = updatedInvoice;
    db.user.openingCashBalance += appliedAmount;

    saveDatabase(db);
    res.status(201).json({
      payment,
      invoice: updatedInvoice,
      openingCashBalance: db.user.openingCashBalance,
    });
  });

  // Expenses CRUD
  app.post('/api/expenses', (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    if (typeof b.title !== 'string' || !b.title.trim()) {
      res.status(400).json({ error: 'Expense title is required.' });
      return;
    }
    const today = getTodayISO();
    const status = b.status === 'Paid' ? 'Paid' : 'Upcoming';
    const amount = sanitizePositiveNumber(b.amount, 0);
    const expense: Expense = {
      id: makeId('exp'),
      title: b.title.trim(),
      category: b.category || 'Miscellaneous',
      amount,
      dueDate: sanitizeDateString(b.dueDate, today),
      paidDate: status === 'Paid' ? sanitizeDateString(b.paidDate, today) : undefined,
      isRecurring: Boolean(b.isRecurring),
      frequency:
        b.frequency === 'monthly' || b.frequency === 'quarterly' ? b.frequency : 'one-time',
      status,
      vendor: typeof b.vendor === 'string' ? b.vendor.trim() : undefined,
      notes: typeof b.notes === 'string' ? b.notes.trim() : undefined,
      isDemo: false,
    };
    if (status === 'Paid') {
      db.user.openingCashBalance -= amount;
    }
    db.expenses.unshift(expense);
    saveDatabase(db);
    res.status(201).json({ expense, openingCashBalance: db.user.openingCashBalance });
  });

  app.put('/api/expenses/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.expenses.findIndex((e) => e.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }
    const existing = db.expenses[idx];
    const b = req.body ?? {};
    const today = getTodayISO();
    const nextAmount =
      b.amount !== undefined ? sanitizePositiveNumber(b.amount, existing.amount) : existing.amount;
    const nextStatus =
      b.status === 'Paid' || b.status === 'Upcoming' || b.status === 'Overdue'
        ? b.status
        : existing.status;

    // Adjust cash if marking Paid for the first time
    if (existing.status !== 'Paid' && nextStatus === 'Paid') {
      db.user.openingCashBalance -= nextAmount;
    } else if (existing.status === 'Paid' && nextStatus !== 'Paid') {
      db.user.openingCashBalance += existing.amount;
    }

    const updated: Expense = {
      ...existing,
      title: typeof b.title === 'string' && b.title.trim() ? b.title.trim() : existing.title,
      category: b.category || existing.category,
      amount: nextAmount,
      dueDate: sanitizeDateString(b.dueDate, existing.dueDate),
      paidDate: nextStatus === 'Paid' ? sanitizeDateString(b.paidDate, today) : undefined,
      isRecurring: typeof b.isRecurring === 'boolean' ? b.isRecurring : existing.isRecurring,
      frequency:
        b.frequency === 'monthly' || b.frequency === 'quarterly' || b.frequency === 'one-time'
          ? b.frequency
          : existing.frequency,
      status: nextStatus,
      vendor: typeof b.vendor === 'string' ? b.vendor.trim() : existing.vendor,
      notes: typeof b.notes === 'string' ? b.notes.trim() : existing.notes,
    };

    db.expenses[idx] = updated;
    saveDatabase(db);
    res.json({ expense: updated, openingCashBalance: db.user.openingCashBalance });
  });

  app.delete('/api/expenses/:id', (req, res) => {
    const db = loadDatabase();
    const target = db.expenses.find((e) => e.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }
    db.expenses = db.expenses.filter((e) => e.id !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // Save reminder log
  app.post('/api/reminders', (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    const invoice = db.invoices.find((i) => i.id === b.invoiceId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const reminder: Reminder = {
      id: makeId('rem'),
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      channel: b.channel === 'Email' || b.channel === 'SMS' ? b.channel : 'WhatsApp',
      tone: b.tone || 'polite',
      language: b.language === 'Hindi' ? 'Hindi' : 'English',
      message: typeof b.message === 'string' ? b.message.trim() : '',
      createdAt: new Date().toISOString(),
      followUpStatus: b.followUpStatus || 'Drafted',
      note: typeof b.note === 'string' ? b.note.trim() : undefined,
    };
    db.reminders.unshift(reminder);
    saveDatabase(db);
    res.status(201).json(reminder);
  });

  // Save what-if scenario
  app.post('/api/scenarios', (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    const scenario: Scenario = {
      id: makeId('scen'),
      name: typeof b.name === 'string' && b.name.trim() ? b.name.trim() : 'Saved Cash Scenario',
      invoiceId: typeof b.invoiceId === 'string' ? b.invoiceId : '',
      delayDays: Number(b.delayDays) || 15,
      revisedExpectedDate: sanitizeDateString(b.revisedExpectedDate, getTodayISO()),
      extraMonthlyExpense: sanitizePositiveNumber(b.extraMonthlyExpense, 0),
      createdAt: new Date().toISOString(),
    };
    db.scenarios.unshift(scenario);
    saveDatabase(db);
    res.status(201).json(scenario);
  });

  // AI Endpoints
  app.post('/api/ai/reminder', async (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    const invoice = db.invoices.find((i) => i.id === b.invoiceId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const student = db.students.find((s) => s.id === invoice.studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const tone: ReminderTone =
      b.tone === 'friendly_whatsapp' || b.tone === 'professional' || b.tone === 'firm'
        ? b.tone
        : 'polite';
    const language: ReminderLanguage = b.language === 'Hindi' ? 'Hindi' : 'English';
    const history = db.reminders.filter((r) => r.invoiceId === invoice.id);

    const result = await generateReminderWithAI({
      db,
      invoice,
      student,
      tone,
      language,
      history,
    });
    res.json(result);
  });

  app.post('/api/ai/copilot', async (req, res) => {
    const db = loadDatabase();
    const b = req.body ?? {};
    const question = typeof b.question === 'string' ? b.question.trim() : '';
    if (!question) {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }
    const history = Array.isArray(b.history) ? b.history : [];
    const result = await askCopilotWithAI({ db, question, history });
    res.json(result);
  });

  app.get('/api/ai/health-summary', async (_req, res) => {
    const db = loadDatabase();
    const result = await generateHealthSummaryWithAI(db);
    res.json(result);
  });

  // Vite middleware or production static files
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TutorFlow AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
