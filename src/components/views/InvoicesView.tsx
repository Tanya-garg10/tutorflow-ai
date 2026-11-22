import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  History,
  IndianRupee,
  Languages,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AppDatabase,
  FollowUpStatus,
  Invoice,
  InvoiceStatus,
  Reminder,
  ReminderLanguage,
  ReminderTone,
} from '../../types/finance.ts';
import {
  buildTemplateReminder,
  deriveInvoiceStatus,
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
  getOverdueDays,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { api } from '../../services/api.ts';
import { StatusText } from '../ui/StatusText.tsx';

interface InvoicesViewProps {
  db: AppDatabase;
  highlightedInvoiceId?: string | null;
  onNewInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => Promise<void>;
  onIssueDraft: (invoice: Invoice) => Promise<void>;
  onRecordPayment: (invoice: Invoice) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onOpenReminder: (invoice: Invoice) => void;
  onSavedReminder: (reminder: Reminder) => void;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const TONE_OPTIONS: Array<{ id: ReminderTone; label: string }> = [
  { id: 'polite', label: 'Polite' },
  { id: 'friendly_whatsapp', label: 'Friendly' },
  { id: 'professional', label: 'Professional' },
  { id: 'firm', label: 'Firm' },
];

export function InvoicesView({
  db,
  highlightedInvoiceId,
  onNewInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onIssueDraft,
  onRecordPayment,
  onPreviewInvoice,
  onOpenReminder,
  onSavedReminder,
  onToast,
}: InvoicesViewProps) {
  const todayStr = getTodayISO();
  const [viewMode, setViewMode] = useState<'ledger' | 'followups'>('ledger');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const studentMap = new Map(db.students.map((s) => [s.id, s]));

  const enriched = useMemo(() => {
    return db.invoices.map((inv) => {
      const derivedStatus = deriveInvoiceStatus(inv, todayStr);
      const remaining = getInvoiceRemaining(inv);
      const overdueDays = derivedStatus === 'Overdue' ? getOverdueDays(inv.dueDate, todayStr) : 0;
      const student = studentMap.get(inv.studentId);
      return {
        inv,
        derivedStatus,
        remaining,
        overdueDays,
        student,
        studentName: student?.fullName ?? 'Unknown Student',
        studentGrade: student?.grade ?? '',
      };
    });
  }, [db.invoices, db.students, todayStr]);

  // Summary totals
  const totalInvoiced = enriched
    .filter((r) => r.derivedStatus !== 'Draft')
    .reduce((a, r) => a + r.inv.totalAmount, 0);
  const totalPaid = enriched
    .filter((r) => r.derivedStatus !== 'Draft')
    .reduce((a, r) => a + r.inv.paidAmount, 0);
  const totalPending = enriched
    .filter((r) => r.derivedStatus === 'Unpaid' || r.derivedStatus === 'Partially Paid')
    .reduce((a, r) => a + r.remaining, 0);
  const totalOverdue = enriched
    .filter((r) => r.derivedStatus === 'Overdue')
    .reduce((a, r) => a + r.remaining, 0);

  const filtered = enriched.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      row.inv.invoiceNumber.toLowerCase().includes(q) ||
      row.studentName.toLowerCase().includes(q) ||
      row.inv.description.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'All' ? true : row.derivedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Split AI Follow-ups workspace state
  const openFollowupRows = useMemo(
    () =>
      enriched
        .filter((r) => r.derivedStatus !== 'Draft' && r.remaining > 0)
        .sort((a, b) => b.overdueDays - a.overdueDays || a.inv.dueDate.localeCompare(b.inv.dueDate)),
    [enriched]
  );

  const [selectedFollowupId, setSelectedFollowupId] = useState<string>(
    openFollowupRows[0]?.inv.id ?? ''
  );
  const [tone, setTone] = useState<ReminderTone>('polite');
  const [language, setLanguage] = useState<ReminderLanguage>('English');
  const [message, setMessage] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>('Drafted');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<'gemini' | 'template'>('template');
  const [copied, setCopied] = useState(false);

  const activeFollowup =
    openFollowupRows.find((r) => r.inv.id === selectedFollowupId) ?? openFollowupRows[0] ?? null;

  useEffect(() => {
    if (!activeFollowup || !activeFollowup.student) return;
    setSelectedFollowupId(activeFollowup.inv.id);
    const defaultMsg = buildTemplateReminder({
      studentName: activeFollowup.student.fullName,
      amount: activeFollowup.remaining,
      overdueDays: activeFollowup.overdueDays,
      dueDate: activeFollowup.inv.dueDate,
      invoiceNumber: activeFollowup.inv.invoiceNumber,
      upiId: db.user.upiId,
      tone,
      language,
      isPartial: activeFollowup.inv.paidAmount > 0 && activeFollowup.remaining > 0,
    });
    setMessage(defaultMsg);
    setSourceLabel('template');
    setCopied(false);
  }, [activeFollowup?.inv.id, tone, language, db.user.upiId]);

  const handleGenerateSplitAI = async () => {
    if (!activeFollowup) return;
    setGenerating(true);
    try {
      const res = await api.generateAIReminder({
        invoiceId: activeFollowup.inv.id,
        tone,
        language,
      });
      setMessage(res.message);
      setSourceLabel(res.source);
      onToast(
        'info',
        res.source === 'gemini'
          ? 'AI reminder drafted with Gemini.'
          : 'Reminder drafted with smart template.'
      );
    } catch {
      onToast('error', 'Could not reach AI service; template remains ready.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSplitLog = async (
    statusOverride?: FollowUpStatus,
    channel: Reminder['channel'] = 'WhatsApp'
  ) => {
    if (!activeFollowup) return;
    try {
      const saved = await api.saveReminder({
        invoiceId: activeFollowup.inv.id,
        channel,
        tone,
        language,
        message,
        followUpStatus: statusOverride ?? followUpStatus,
        note: note.trim() || undefined,
      });
      onSavedReminder(saved);
      if (!statusOverride) {
        onToast('success', 'Follow-up saved to reminder history.');
      }
    } catch {
      onToast('error', 'Failed to save follow-up log.');
    }
  };

  const activeReminders = activeFollowup
    ? db.reminders.filter((r) => r.invoiceId === activeFollowup.inv.id)
    : [];

  const sanitizedDigits = activeFollowup?.student?.phone.replace(/\D/g, '') ?? '';
  const whatsappNumber =
    sanitizedDigits.length === 10 ? `91${sanitizedDigits}` : sanitizedDigits;
  const hasPhone = whatsappNumber.length >= 10;

  const filterTabs: Array<'All' | InvoiceStatus> = [
    'All',
    'Overdue',
    'Partially Paid',
    'Unpaid',
    'Paid',
    'Draft',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
            Invoices &amp; Payments
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Track tuition billing, partial UPI settlements, and AI payment follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-white border border-[#EAECF2]">
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'ledger'
                  ? 'bg-[#F0ECFF] text-[#7257E8]'
                  : 'text-[#717789] hover:text-[#171923]'
              }`}
            >
              Invoices Ledger
            </button>
            <button
              type="button"
              onClick={() => setViewMode('followups')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'followups'
                  ? 'bg-[#F0ECFF] text-[#7257E8]'
                  : 'text-[#717789] hover:text-[#171923]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Follow-ups ({openFollowupRows.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onNewInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors shadow-[0_2px_8px_rgba(114,87,232,0.25)] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Total Invoiced</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
            {formatINR(totalInvoiced)}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">
            {enriched.filter((r) => r.derivedStatus !== 'Draft').length} issued invoices
          </div>
        </div>
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Paid</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#16A36A] mt-1">
            {formatINR(totalPaid)}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">Collected to date</div>
        </div>
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Pending</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#4779E8] mt-1">
            {formatINR(totalPending)}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">Not yet overdue</div>
        </div>
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Overdue</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#E35454] mt-1">
            {formatINR(totalOverdue)}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">
            {enriched.filter((r) => r.derivedStatus === 'Overdue').length} overdue invoices
          </div>
        </div>
      </section>

      {viewMode === 'ledger' ? (
        <>
          {/* Filter Toolbar */}
          <div className="fintech-card p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#717789] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice # or student..."
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] pl-8 pr-3 py-2 text-xs text-[#171923] placeholder:text-[#717789] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
              {filterTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab
                      ? 'bg-white text-[#7257E8] shadow-xs border border-[#EAECF2]'
                      : 'text-[#717789] hover:text-[#171923]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="fintech-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAECF2] text-[11px] font-semibold uppercase tracking-wider text-[#717789] bg-[#F7F8FC]/70">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF2] text-sm">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm text-[#717789]">
                        No invoices found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(
                      ({
                        inv,
                        derivedStatus,
                        remaining,
                        overdueDays,
                        studentName,
                        studentGrade,
                      }) => {
                        const isHighlighted = highlightedInvoiceId === inv.id;
                        return (
                          <tr
                            key={inv.id}
                            className={`transition-colors ${
                              isHighlighted ? 'bg-[#F0ECFF]/60' : 'hover:bg-[#F7F8FC]'
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-mono text-xs font-semibold text-[#171923]">
                                {inv.invoiceNumber}
                              </div>
                              <div className="text-[11px] text-[#717789] truncate max-w-[180px]">
                                {inv.description}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-[#171923]">{studentName}</div>
                              <div className="text-xs text-[#717789]">{studentGrade}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#717789] whitespace-nowrap">
                              {formatFullDate(inv.issueDate)}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#717789] whitespace-nowrap">
                              {formatFullDate(inv.dueDate)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#717789]">
                              {formatINR(inv.totalAmount)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#16A36A]">
                              {formatINR(inv.paidAmount)}
                            </td>
                            <td
                              className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums ${
                                derivedStatus === 'Overdue'
                                  ? 'text-[#E35454]'
                                  : remaining > 0
                                    ? 'text-[#171923]'
                                    : 'text-[#717789]'
                              }`}
                            >
                              {formatINR(remaining)}
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusText
                                status={derivedStatus}
                                extraLabel={
                                  overdueDays > 0
                                    ? `${overdueDays}d`
                                    : inv.paidAmount > 0 && remaining > 0
                                      ? 'partial'
                                      : undefined
                                }
                              />
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                {derivedStatus === 'Draft' ? (
                                  <button
                                    type="button"
                                    onClick={() => onIssueDraft(inv)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-xs font-semibold bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors whitespace-nowrap"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Issue
                                  </button>
                                ) : (
                                  remaining > 0 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => onOpenReminder(inv)}
                                        title="AI Payment Reminder"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors whitespace-nowrap"
                                      >
                                        <Send className="w-3 h-3" />
                                        Remind
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onRecordPayment(inv)}
                                        title="Record full or partial payment"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors whitespace-nowrap"
                                      >
                                        <IndianRupee className="w-3 h-3" />
                                        Pay
                                      </button>
                                    </>
                                  )
                                )}

                                <button
                                  type="button"
                                  onClick={() => onPreviewInvoice(inv)}
                                  title="Preview & Print Invoice"
                                  className="p-1.5 rounded-lg text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC]"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditInvoice(inv)}
                                  title="Edit Invoice"
                                  className="p-1.5 rounded-lg text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC]"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                {confirmDeleteId === inv.id ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await onDeleteInvoice(inv.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 rounded-md text-xs font-semibold bg-[#E35454] text-white"
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(inv.id)}
                                    title="Delete Invoice"
                                    className="p-1.5 rounded-lg text-[#717789] hover:text-[#E35454] hover:bg-[#E35454]/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Split-Layout AI Payment Follow-ups Workspace */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT: Scrollable list of pending & overdue invoices */}
          <div className="xl:col-span-5 fintech-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAECF2] bg-[#F7F8FC]/60">
              <h2 className="font-display font-semibold text-sm text-[#171923]">
                Pending &amp; Overdue Follow-ups ({openFollowupRows.length})
              </h2>
              <p className="text-xs text-[#717789] mt-0.5">
                Select a student to draft or send an English / Hindi payment reminder
              </p>
            </div>
            <div className="divide-y divide-[#EAECF2] max-h-[560px] overflow-y-auto">
              {openFollowupRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#717789]">
                  All invoices are paid — no follow-ups needed!
                </div>
              ) : (
                openFollowupRows.map((row) => {
                  const selected = activeFollowup?.inv.id === row.inv.id;
                  const remCount = db.reminders.filter((r) => r.invoiceId === row.inv.id).length;
                  return (
                    <button
                      key={row.inv.id}
                      type="button"
                      onClick={() => setSelectedFollowupId(row.inv.id)}
                      className={`w-full text-left px-5 py-3.5 transition-colors flex items-center justify-between gap-3 ${
                        selected ? 'bg-[#F0ECFF]/70' : 'hover:bg-[#F7F8FC]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#171923] truncate">
                            {row.studentName}
                          </span>
                          {row.overdueDays > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E35454]/10 text-[#E35454]">
                              {row.overdueDays}d overdue
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#717789] mt-0.5">
                          {row.inv.invoiceNumber} · Due {formatFullDate(row.inv.dueDate)} ·{' '}
                          {remCount} reminder{remCount === 1 ? '' : 's'} sent
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm tabular-nums text-[#171923]">
                          {formatINR(row.remaining)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Clean Chat-like AI Reminder Composer */}
          <div className="xl:col-span-7 fintech-card p-5 sm:p-6 space-y-5">
            {!activeFollowup ? (
              <div className="py-12 text-center text-sm text-[#717789]">
                Select an unpaid invoice to compose an AI payment reminder.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EAECF2]">
                  <div>
                    <h2 className="font-display font-semibold text-base text-[#171923]">
                      {activeFollowup.studentName} · {activeFollowup.inv.invoiceNumber}
                    </h2>
                    <p className="text-xs text-[#717789] mt-0.5">
                      Balance {formatINR(activeFollowup.remaining)} · Due{' '}
                      {formatFullDate(activeFollowup.inv.dueDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRecordPayment(activeFollowup.inv)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors"
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    Record Payment
                  </button>
                </div>

                {/* Tone & Language Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#717789] mb-1.5">Tone</label>
                    <div className="flex flex-wrap gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
                      {TONE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTone(opt.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            tone === opt.id
                              ? 'bg-white text-[#7257E8] shadow-xs border border-[#EAECF2]'
                              : 'text-[#717789] hover:text-[#171923]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#717789] mb-1.5">
                      Language
                    </label>
                    <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
                      {(['English', 'Hindi'] as ReminderLanguage[]).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setLanguage(lang)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            language === lang
                              ? 'bg-[#F0ECFF] text-[#7257E8]'
                              : 'text-[#717789] hover:text-[#171923]'
                          }`}
                        >
                          <Languages className="w-3.5 h-3.5" />
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chat-like Composer */}
                <div className="rounded-xl bg-[#F7F8FC] border border-[#EAECF2] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-[#171923]">
                      <span className="w-6 h-6 rounded-full bg-[#F0ECFF] text-[#7257E8] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                      <span>Message Preview</span>
                      <span className="text-[#717789] font-normal">
                        · {sourceLabel === 'gemini' ? 'Gemini AI' : 'Smart template'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateSplitAI}
                      disabled={generating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors disabled:opacity-50"
                    >
                      {generating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {generating ? 'Drafting...' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3.5 py-2.5 text-sm text-[#171923] leading-relaxed focus:outline-none focus:border-[#7257E8]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#717789] mb-1">
                      Follow-up Status
                    </label>
                    <select
                      value={followUpStatus}
                      onChange={(e) => setFollowUpStatus(e.target.value as FollowUpStatus)}
                      className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
                    >
                      <option value="Drafted">Drafted</option>
                      <option value="Copied">Copied</option>
                      <option value="Opened in WhatsApp">Opened in WhatsApp</option>
                      <option value="Follow-up Scheduled">Follow-up Scheduled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#717789] mb-1">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Parent promised payment Friday"
                      className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(message);
                          setCopied(true);
                          setFollowUpStatus('Copied');
                          await handleSaveSplitLog('Copied', 'WhatsApp');
                          onToast('success', 'Message copied and logged.');
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          onToast('error', 'Clipboard copy failed.');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-medium bg-white border border-[#EAECF2] text-[#171923] hover:bg-[#F7F8FC]"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-[#16A36A]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#7257E8]" />
                      )}
                      {copied ? 'Copied' : 'Copy Message'}
                    </button>

                    {hasPhone && (
                      <a
                        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          setFollowUpStatus('Opened in WhatsApp');
                          void handleSaveSplitLog('Opened in WhatsApp', 'WhatsApp');
                          onToast('info', 'Opened WhatsApp compose link with message pre-filled.');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A]/15"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Open WhatsApp
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveSplitLog()}
                    className="px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6]"
                  >
                    Save Log
                  </button>
                </div>

                {activeReminders.length > 0 && (
                  <div className="pt-3 border-t border-[#EAECF2] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#717789]">
                      <History className="w-3.5 h-3.5" />
                      <span>Follow-up History ({activeReminders.length})</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeReminders.map((rem) => (
                        <div
                          key={rem.id}
                          className="p-3 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[#717789]">
                            <span>
                              {rem.createdAt.slice(0, 10)} · {rem.language} ·{' '}
                              {rem.tone.replace('_', ' ')}
                            </span>
                            <span className="text-[#7257E8] font-semibold">
                              {rem.followUpStatus}
                            </span>
                          </div>
                          <p className="text-[#171923]">{rem.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
