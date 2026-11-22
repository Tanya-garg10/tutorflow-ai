import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import type {
  ActionItem,
  AppDatabase,
  Expense,
  Invoice,
  NavSection,
  PaymentMethod,
  Reminder,
  Student,
  UserProfile,
} from './types/finance.ts';
import { api, cacheDatabaseLocally } from './services/api.ts';
import {
  deriveInvoiceStatus,
  generateActionCenterItems,
  getTodayISO,
} from './services/financeEngine.ts';
import { Layout } from './components/Layout.tsx';
import { ToastContainer, type ToastMessage } from './components/ui/Toast.tsx';
import { AIReminderModal } from './components/modals/AIReminderModal.tsx';
import {
  InvoiceFormModal,
  InvoicePreviewModal,
  RecordPaymentModal,
} from './components/modals/InvoiceModals.tsx';
import { OverviewView } from './components/views/OverviewView.tsx';
import { StudentsView } from './components/views/StudentsView.tsx';
import { InvoicesView } from './components/views/InvoicesView.tsx';
import { PaymentsView } from './components/views/PaymentsView.tsx';
import { ExpensesView } from './components/views/ExpensesView.tsx';
import { ForecastView } from './components/views/ForecastView.tsx';
import { SimulatorView } from './components/views/SimulatorView.tsx';
import { ActionCenterView } from './components/views/ActionCenterView.tsx';
import { CopilotView } from './components/views/CopilotView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';

export default function App() {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal & highlight states
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [preselectedStudentId, setPreselectedStudentId] = useState<string | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [previewModalInvoice, setPreviewModalInvoice] = useState<Invoice | null>(null);
  const [reminderModalInvoice, setReminderModalInvoice] = useState<Invoice | null>(null);

  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const [highlightedExpenseId, setHighlightedExpenseId] = useState<string | null>(null);
  const [simInvoiceId, setSimInvoiceId] = useState<string | null>(null);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const next = await api.getState();
      setDb(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const updateDbAndCache = useCallback((updater: (prev: AppDatabase) => AppDatabase) => {
    setDb((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      cacheDatabaseLocally(next);
      return next;
    });
  }, []);

  const todayStr = getTodayISO();

  const actions = useMemo(() => {
    if (!db) return [];
    return generateActionCenterItems(db, todayStr);
  }, [db, todayStr]);

  const overdueCount = useMemo(() => {
    if (!db) return 0;
    return db.invoices.filter((i) => deriveInvoiceStatus(i, todayStr) === 'Overdue').length;
  }, [db, todayStr]);

  const nextInvoiceNumber = useMemo(() => {
    if (!db) return `INV-${new Date().getFullYear()}-120`;
    return `INV-${new Date().getFullYear()}-${117 + db.invoices.length}`;
  }, [db]);

  // Handlers
  const handleCreateStudent = async (payload: Omit<Student, 'id'>) => {
    const created = await api.createStudent(payload);
    updateDbAndCache((prev) => ({
      ...prev,
      students: [created, ...prev.students],
    }));
    pushToast('success', `Added student ${created.fullName}.`);
  };

  const handleUpdateStudent = async (id: string, payload: Partial<Student>) => {
    const updated = await api.updateStudent(id, payload);
    updateDbAndCache((prev) => ({
      ...prev,
      students: prev.students.map((s) => (s.id === id ? updated : s)),
    }));
    pushToast('success', `Updated ${updated.fullName}.`);
  };

  const handleDeleteStudent = async (id: string) => {
    await api.deleteStudent(id);
    updateDbAndCache((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
      invoices: prev.invoices.filter((i) => i.studentId !== id),
      payments: prev.payments.filter((p) => p.studentId !== id),
    }));
    pushToast('info', 'Student and linked invoices removed.');
  };

  const handleSaveInvoice = async (payload: {
    id?: string;
    studentId: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    expectedPaymentDate: string;
    description: string;
    billingMonth: string;
    amount: number;
    discount: number;
    status: 'Draft' | 'Unpaid';
  }) => {
    if (payload.id) {
      const updated = await api.updateInvoice(payload.id, payload);
      updateDbAndCache((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === payload.id ? updated : i)),
      }));
      pushToast('success', `Updated invoice ${updated.invoiceNumber}.`);
    } else {
      const created = await api.createInvoice(payload);
      updateDbAndCache((prev) => ({
        ...prev,
        invoices: [created, ...prev.invoices],
      }));
      pushToast('success', `Created invoice ${created.invoiceNumber}.`);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    await api.deleteInvoice(id);
    updateDbAndCache((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((i) => i.id !== id),
      payments: prev.payments.filter((p) => p.invoiceId !== id),
    }));
    pushToast('info', 'Invoice deleted.');
  };

  const handleIssueDraft = async (invoice: Invoice) => {
    const updated = await api.updateInvoice(invoice.id, { status: 'Unpaid' });
    updateDbAndCache((prev) => ({
      ...prev,
      invoices: prev.invoices.map((i) => (i.id === invoice.id ? updated : i)),
    }));
    pushToast('success', `Issued ${updated.invoiceNumber}.`);
  };

  const handleRecordPayment = async (payload: {
    invoiceId: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => {
    const res = await api.recordPayment(payload);
    updateDbAndCache((prev) => ({
      ...prev,
      payments: [res.payment, ...prev.payments],
      invoices: prev.invoices.map((i) => (i.id === res.invoice.id ? res.invoice : i)),
      user: {
        ...prev.user,
        openingCashBalance: res.openingCashBalance,
      },
    }));
    pushToast('success', `Recorded payment of ₹${res.payment.amount.toLocaleString('en-IN')}.`);
  };

  const handleCreateExpense = async (payload: Omit<Expense, 'id'>) => {
    const res = await api.createExpense(payload);
    updateDbAndCache((prev) => ({
      ...prev,
      expenses: [res.expense, ...prev.expenses],
      user: {
        ...prev.user,
        openingCashBalance: res.openingCashBalance,
      },
    }));
    pushToast('success', `Added expense "${res.expense.title}".`);
  };

  const handleUpdateExpense = async (id: string, payload: Partial<Expense>) => {
    const res = await api.updateExpense(id, payload);
    updateDbAndCache((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === id ? res.expense : e)),
      user: {
        ...prev.user,
        openingCashBalance: res.openingCashBalance,
      },
    }));
    pushToast('success', `Updated expense "${res.expense.title}".`);
  };

  const handleDeleteExpense = async (id: string) => {
    await api.deleteExpense(id);
    updateDbAndCache((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    pushToast('info', 'Expense removed.');
  };

  const handleSavedReminder = (reminder: Reminder) => {
    updateDbAndCache((prev) => ({
      ...prev,
      reminders: [reminder, ...prev.reminders],
    }));
  };

  const handleSaveScenario = async (payload: {
    name: string;
    invoiceId: string;
    delayDays: number;
    revisedExpectedDate: string;
    extraMonthlyExpense: number;
  }) => {
    const created = await api.saveScenario(payload);
    updateDbAndCache((prev) => ({
      ...prev,
      scenarios: [created, ...prev.scenarios],
    }));
    pushToast('success', `Saved scenario "${created.name}".`);
  };

  const handleSaveSettings = async (payload: Partial<UserProfile>) => {
    const updated = await api.updateSettings(payload);
    updateDbAndCache((prev) => ({
      ...prev,
      user: updated,
    }));
    pushToast('success', 'Settings saved and forecasts updated.');
  };

  const handleResetDemo = async () => {
    const resetDb = await api.resetDemo();
    setDb(resetDb);
    pushToast('info', 'Demo dataset restored to initial state.');
  };

  const handleActionClick = (action: ActionItem) => {
    if (action.targetView === 'invoices') {
      const inv = db?.invoices.find((i) => i.id === action.targetId);
      setHighlightedInvoiceId(action.targetId);
      setActiveNav('invoices');
      if (
        inv &&
        (action.category === 'overdue_invoice' ||
          action.category === 'due_soon' ||
          action.category === 'partial_followup')
      ) {
        setReminderModalInvoice(inv);
      }
      return;
    }
    if (action.targetView === 'expenses') {
      setHighlightedExpenseId(action.targetId);
      setActiveNav('expenses');
      return;
    }
    if (action.targetView === 'simulator') {
      setSimInvoiceId(action.targetId);
      setActiveNav('simulator');
      return;
    }
    setActiveNav(action.targetView);
  };

  const handleJumpToStudent = (studentId: string) => {
    setHighlightedStudentId(studentId);
    setActiveNav('students');
  };

  const handleJumpToInvoice = (invoiceId: string) => {
    setHighlightedInvoiceId(invoiceId);
    setActiveNav('invoices');
  };

  if (loading || !db) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] text-[#171923] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="h-6 w-40 rounded-lg bg-white border border-[#EAECF2] animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 rounded-2xl bg-white border border-[#EAECF2] animate-pulse" />
            <div className="h-24 rounded-2xl bg-white border border-[#EAECF2] animate-pulse" />
          </div>
          <div className="h-48 rounded-2xl bg-white border border-[#EAECF2] animate-pulse" />
        </div>
      </div>
    );
  }

  const studentMap = new Map(db.students.map((s) => [s.id, s]));

  const openNewInvoice = (studentId?: string) => {
    setEditingInvoice(null);
    setPreselectedStudentId(studentId ?? null);
    setInvoiceFormOpen(true);
  };

  const openEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setPreselectedStudentId(null);
    setInvoiceFormOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <Layout
        activeNav={activeNav}
        onSelectNav={(nav) => {
          setActiveNav(nav);
          setHighlightedStudentId(null);
          setHighlightedInvoiceId(null);
          setHighlightedExpenseId(null);
        }}
        db={db}
        actions={actions}
        overdueCount={overdueCount}
        onNewInvoice={() => openNewInvoice()}
        onActionClick={handleActionClick}
        onJumpToStudent={handleJumpToStudent}
        onJumpToInvoice={handleJumpToInvoice}
        onResetDemo={handleResetDemo}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeNav}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeNav === 'overview' && (
              <OverviewView
                db={db}
                actions={actions}
                onNavigate={setActiveNav}
                onNewInvoice={() => openNewInvoice()}
                onOpenReminder={(inv) => setReminderModalInvoice(inv)}
                onRecordPayment={(inv) => setPaymentModalInvoice(inv)}
                onActionClick={handleActionClick}
              />
            )}

            {activeNav === 'students' && (
              <StudentsView
                db={db}
                highlightedStudentId={highlightedStudentId}
                onCreateStudent={handleCreateStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onOpenNewInvoiceForStudent={(stuId) => openNewInvoice(stuId)}
                onOpenReminder={(inv) => setReminderModalInvoice(inv)}
                onRecordPayment={(inv) => setPaymentModalInvoice(inv)}
              />
            )}

            {activeNav === 'invoices' && (
              <InvoicesView
                db={db}
                highlightedInvoiceId={highlightedInvoiceId}
                onNewInvoice={() => openNewInvoice()}
                onEditInvoice={openEditInvoice}
                onDeleteInvoice={handleDeleteInvoice}
                onIssueDraft={handleIssueDraft}
                onRecordPayment={(inv) => setPaymentModalInvoice(inv)}
                onPreviewInvoice={(inv) => setPreviewModalInvoice(inv)}
                onOpenReminder={(inv) => setReminderModalInvoice(inv)}
                onSavedReminder={handleSavedReminder}
                onToast={pushToast}
              />
            )}

            {activeNav === 'payments' && (
              <PaymentsView
                db={db}
                onRecordPayment={(inv) => setPaymentModalInvoice(inv)}
              />
            )}

            {activeNav === 'expenses' && (
              <ExpensesView
                db={db}
                highlightedExpenseId={highlightedExpenseId}
                onCreateExpense={handleCreateExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}

            {activeNav === 'forecast' && (
              <ForecastView
                db={db}
                onSaveAssumptions={async (assumptions) => {
                  await handleSaveSettings(assumptions);
                }}
                onOpenSimulator={() => setActiveNav('simulator')}
              />
            )}

            {activeNav === 'simulator' && (
              <SimulatorView
                db={db}
                preselectedInvoiceId={simInvoiceId}
                onSaveScenario={handleSaveScenario}
              />
            )}

            {activeNav === 'action-center' && (
              <ActionCenterView actions={actions} onActionClick={handleActionClick} />
            )}

            {activeNav === 'copilot' && <CopilotView />}

            {activeNav === 'settings' && (
              <SettingsView
                user={db.user}
                onSaveSettings={handleSaveSettings}
                onResetDemo={handleResetDemo}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Global Modals */}
        <InvoiceFormModal
          open={invoiceFormOpen}
          onClose={() => setInvoiceFormOpen(false)}
          students={
            preselectedStudentId
              ? [
                  ...db.students.filter((s) => s.id === preselectedStudentId),
                  ...db.students.filter((s) => s.id !== preselectedStudentId),
                ]
              : db.students
          }
          existingInvoice={editingInvoice}
          nextInvoiceNumber={nextInvoiceNumber}
          onSubmit={handleSaveInvoice}
        />

        <RecordPaymentModal
          open={Boolean(paymentModalInvoice)}
          onClose={() => setPaymentModalInvoice(null)}
          invoice={paymentModalInvoice}
          studentName={
            paymentModalInvoice
              ? studentMap.get(paymentModalInvoice.studentId)?.fullName ?? 'Student'
              : ''
          }
          onSubmit={handleRecordPayment}
        />

        <InvoicePreviewModal
          open={Boolean(previewModalInvoice)}
          onClose={() => setPreviewModalInvoice(null)}
          invoice={previewModalInvoice}
          student={
            previewModalInvoice
              ? studentMap.get(previewModalInvoice.studentId) ?? null
              : null
          }
          user={db.user}
          payments={db.payments}
        />

        <AIReminderModal
          open={Boolean(reminderModalInvoice)}
          onClose={() => setReminderModalInvoice(null)}
          invoice={reminderModalInvoice}
          student={
            reminderModalInvoice
              ? studentMap.get(reminderModalInvoice.studentId) ?? null
              : null
          }
          upiId={db.user.upiId}
          reminders={db.reminders}
          onSavedReminder={handleSavedReminder}
          onToast={pushToast}
        />

        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </Layout>
    </MotionConfig>
  );
}
