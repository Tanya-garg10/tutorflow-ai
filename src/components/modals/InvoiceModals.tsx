import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type {
  Invoice,
  Payment,
  PaymentMethod,
  Student,
  UserProfile,
} from '../../types/finance.ts';
import {
  deriveInvoiceStatus,
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { addDaysISO } from '../../services/seedData.ts';
import { Modal } from '../ui/Modal.tsx';
import { StatusText } from '../ui/StatusText.tsx';

interface InvoiceFormModalProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  existingInvoice: Invoice | null;
  nextInvoiceNumber: string;
  onSubmit: (payload: {
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
  }) => Promise<void>;
}

export function InvoiceFormModal({
  open,
  onClose,
  students,
  existingInvoice,
  nextInvoiceNumber,
  onSubmit,
}: InvoiceFormModalProps) {
  const today = getTodayISO();
  const [studentId, setStudentId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber);
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysISO(today, 7));
  const [expectedPaymentDate, setExpectedPaymentDate] = useState(addDaysISO(today, 7));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState<'Draft' | 'Unpaid'>('Unpaid');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingInvoice) {
      setStudentId(existingInvoice.studentId);
      setInvoiceNumber(existingInvoice.invoiceNumber);
      setIssueDate(existingInvoice.issueDate);
      setDueDate(existingInvoice.dueDate);
      setExpectedPaymentDate(existingInvoice.expectedPaymentDate);
      setDescription(existingInvoice.description);
      setAmount(existingInvoice.amount);
      setDiscount(existingInvoice.discount);
      setStatus(existingInvoice.status === 'Draft' ? 'Draft' : 'Unpaid');
    } else {
      const firstStu = students[0];
      setStudentId(firstStu?.id ?? '');
      setInvoiceNumber(nextInvoiceNumber);
      setIssueDate(today);
      setDueDate(addDaysISO(today, 7));
      setExpectedPaymentDate(addDaysISO(today, 7));
      setDescription(firstStu ? `${firstStu.subject} Monthly Tuition` : 'Monthly Tuition Fee');
      setAmount(firstStu?.monthlyFee ?? 3000);
      setDiscount(0);
      setStatus('Unpaid');
    }
  }, [open, existingInvoice, students, nextInvoiceNumber, today]);

  const handleStudentChange = (nextId: string) => {
    setStudentId(nextId);
    if (!existingInvoice) {
      const s = students.find((st) => st.id === nextId);
      if (s) {
        setAmount(s.monthlyFee);
        setDescription(`${s.subject} Monthly Tuition`);
      }
    }
  };

  const selectedStudent = students.find((s) => s.id === studentId);
  const netTotal = Math.max(0, (Number(amount) || 0) - (Number(discount) || 0));

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    try {
      await onSubmit({
        id: existingInvoice?.id,
        studentId,
        invoiceNumber,
        issueDate,
        dueDate,
        expectedPaymentDate,
        description,
        billingMonth: new Date(issueDate + 'T00:00:00').toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric',
        }),
        amount: Number(amount) || 0,
        discount: Number(discount) || 0,
        status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existingInvoice ? `Edit ${existingInvoice.invoiceNumber}` : 'Create New Invoice'}
      subtitle="Automatically updates your revenue ledger and 30/60/90-day cash forecast"
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleFormSubmit} className="space-y-5">
        {/* Section 1: Select Student */}
        <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] space-y-3">
          <div className="text-xs font-semibold text-[#7257E8]">1. Select Student</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Student *</label>
              <select
                required
                value={studentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.grade})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm font-mono text-[#171923] focus:outline-none focus:border-[#7257E8]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Invoice Details */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[#171923]">2. Invoice Details</div>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Class 12 Physics Monthly Tuition"
            className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
          />
        </div>

        {/* Section 3: Amount & Discounts */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[#171923]">3. Amount &amp; Discounts</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Fee Amount (₹) *
              </label>
              <input
                type="number"
                min={0}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                min={0}
                max={amount}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Net Total
              </label>
              <div className="w-full rounded-[9px] bg-[#F0ECFF] border border-[#7257E8]/20 px-3 py-2 text-sm font-semibold font-mono tabular-nums text-[#7257E8]">
                {formatINR(netTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Issue & Due Dates */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[#171923]">4. Issue &amp; Due Dates</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Issue Date</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (!existingInvoice) setExpectedPaymentDate(e.target.value);
                }}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Expected Receipt
              </label>
              <input
                type="date"
                required
                value={expectedPaymentDate}
                onChange={(e) => setExpectedPaymentDate(e.target.value)}
                className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Review & Create */}
        <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-[#171923]">5. Review &amp; Issue</div>
            <div className="text-[#717789]">
              {selectedStudent?.fullName ?? 'Student'} · {invoiceNumber} ·{' '}
              <span className="font-mono font-semibold text-[#171923]">{formatINR(netTotal)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatus('Unpaid')}
              className={`px-3 py-1.5 rounded-[9px] text-xs font-medium border transition-colors ${
                status === 'Unpaid'
                  ? 'bg-[#7257E8] border-[#7257E8] text-white'
                  : 'bg-white border-[#EAECF2] text-[#717789]'
              }`}
            >
              Issue Immediately
            </button>
            <button
              type="button"
              onClick={() => setStatus('Draft')}
              className={`px-3 py-1.5 rounded-[9px] text-xs font-medium border transition-colors ${
                status === 'Draft'
                  ? 'bg-[#171923] border-[#171923] text-white'
                  : 'bg-white border-[#EAECF2] text-[#717789]'
              }`}
            >
              Save Draft
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAECF2]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-xs font-medium text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : existingInvoice ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  studentName: string;
  onSubmit: (payload: {
    invoiceId: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => Promise<void>;
}

export function RecordPaymentModal({
  open,
  onClose,
  invoice,
  studentName,
  onSubmit,
}: RecordPaymentModalProps) {
  const today = getTodayISO();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const remaining = invoice ? getInvoiceRemaining(invoice) : 0;

  useEffect(() => {
    if (open && invoice) {
      const rem = getInvoiceRemaining(invoice);
      setAmount(rem);
      setDate(getTodayISO());
      setMethod('UPI');
      setReference(`UPI-${Math.floor(10000000 + Math.random() * 89999999)}`);
      setNotes('');
    }
  }, [open, invoice]);

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setSaving(true);
    try {
      await onSubmit({
        invoiceId: invoice.id,
        amount: Math.min(remaining, Number(amount) || 0),
        date,
        method,
        reference,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      subtitle={`${studentName} · ${invoice.invoiceNumber} · Balance due ${formatINR(remaining)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[#717789]">Payment Amount (₹) *</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAmount(Math.round(remaining / 2))}
                className="px-2.5 py-0.5 rounded-md bg-[#F0ECFF] text-[11px] font-medium text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors"
              >
                50% ({formatINR(Math.round(remaining / 2))})
              </button>
              <button
                type="button"
                onClick={() => setAmount(remaining)}
                className="px-2.5 py-0.5 rounded-md bg-[#16A36A]/10 text-[11px] font-medium text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors"
              >
                Full ({formatINR(remaining)})
              </button>
            </div>
          </div>
          <input
            type="number"
            min={1}
            max={remaining}
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2.5 text-base font-mono font-semibold tabular-nums text-[#171923] focus:outline-none focus:border-[#7257E8]"
          />
          {amount > 0 && amount < remaining && (
            <p className="text-xs text-[#EAA23B] mt-1 font-medium">
              Recording partial payment — {formatINR(remaining - amount)} will remain pending.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Payment Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
            >
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#717789] mb-1">
            Transaction Reference
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="UPI Ref / UTR / Receipt #"
            className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm font-mono text-[#171923] focus:outline-none focus:border-[#7257E8]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#717789] mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Received via GPay"
            className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAECF2]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-xs font-medium text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || amount <= 0}
            className="px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#16A36A] text-white hover:bg-[#138A58] transition-colors disabled:opacity-50"
          >
            {saving ? 'Recording...' : `Confirm ${formatINR(amount)}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface InvoicePreviewModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  student: Student | null;
  user: UserProfile;
  payments: Payment[];
}

export function InvoicePreviewModal({
  open,
  onClose,
  invoice,
  student,
  user,
  payments,
}: InvoicePreviewModalProps) {
  if (!invoice || !student) return null;

  const derivedStatus = deriveInvoiceStatus(invoice);
  const remaining = getInvoiceRemaining(invoice);
  const invPayments = payments.filter((p) => p.invoiceId === invoice.id);

  const handleDownloadText = () => {
    const content = [
      `${user.businessName} — Tuition Invoice`,
      `==========================================`,
      `Invoice #: ${invoice.invoiceNumber}`,
      `Status: ${derivedStatus}`,
      `Issue Date: ${formatFullDate(invoice.issueDate)}`,
      `Due Date: ${formatFullDate(invoice.dueDate)}`,
      ``,
      `Billed To: ${student.fullName} (${student.grade} · ${student.subject})`,
      `Phone: ${student.phone}`,
      ``,
      `Description: ${invoice.description}`,
      `Subtotal: ${formatINR(invoice.amount)}`,
      `Discount: ${formatINR(invoice.discount)}`,
      `Total Due: ${formatINR(invoice.totalAmount)}`,
      `Paid So Far: ${formatINR(invoice.paidAmount)}`,
      `Balance Remaining: ${formatINR(remaining)}`,
      ``,
      `Pay via UPI: ${user.upiId}`,
      `Tutor Contact: ${user.name} (${user.phone})`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}-${student.fullName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invoice Preview · ${invoice.invoiceNumber}`}
      subtitle="Clean printable tuition statement & receipt"
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 no-print">
          <StatusText status={derivedStatus} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-medium bg-white text-[#171923] border border-[#EAECF2] hover:bg-[#F7F8FC] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#7257E8]" />
              Download Receipt
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>

        <div className="print-only-area rounded-2xl bg-[#F7F8FC]/60 text-[#171923] p-6 sm:p-8 space-y-6 border border-[#EAECF2]">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#EAECF2] pb-5">
            <div>
              <h3 className="font-display text-xl font-bold text-[#171923]">{user.businessName}</h3>
              <p className="text-xs text-[#717789] mt-1">
                {user.name} · {user.phone} · {user.email}
              </p>
              <p className="text-xs text-[#7257E8] font-mono mt-0.5">UPI: {user.upiId}</p>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#717789]">
                Invoice
              </div>
              <div className="text-lg font-mono font-bold text-[#171923]">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-[#717789] mt-1">
                Issued: {formatFullDate(invoice.issueDate)}
              </div>
              <div className="text-xs text-[#717789]">
                Due: {formatFullDate(invoice.dueDate)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold uppercase tracking-wider text-[#717789] mb-1">
                Billed To
              </div>
              <div className="text-sm font-semibold text-[#171923]">{student.fullName}</div>
              <div className="text-[#717789]">
                {student.grade} · {student.subject}
              </div>
              <div className="text-[#717789]">{student.phone}</div>
              {student.email && <div className="text-[#717789]">{student.email}</div>}
            </div>
            <div className="sm:text-right">
              <div className="font-semibold uppercase tracking-wider text-[#717789] mb-1">
                Status
              </div>
              <div className="text-sm font-semibold text-[#171923]">{derivedStatus}</div>
              <div className="text-[#717789] mt-1">Billing Period: {invoice.billingMonth}</div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse bg-white rounded-xl overflow-hidden border border-[#EAECF2]">
            <thead>
              <tr className="border-b border-[#EAECF2] text-left text-xs text-[#717789] bg-[#F7F8FC]">
                <th className="py-2.5 px-4 font-medium">Description</th>
                <th className="py-2.5 px-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF2]">
              <tr>
                <td className="py-3 px-4 text-[#171923]">{invoice.description}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#171923]">
                  {formatINR(invoice.amount)}
                </td>
              </tr>
              {invoice.discount > 0 && (
                <tr>
                  <td className="py-2.5 px-4 text-[#717789]">Scholarship / Sibling Discount</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#16A36A]">
                    -{formatINR(invoice.discount)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-1.5 text-sm border-t border-[#EAECF2] pt-3">
              <div className="flex justify-between text-[#717789]">
                <span>Invoice Total</span>
                <span className="font-mono tabular-nums font-medium text-[#171923]">
                  {formatINR(invoice.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-[#717789]">
                <span>Paid to Date</span>
                <span className="font-mono tabular-nums text-[#16A36A]">
                  {formatINR(invoice.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#171923] border-t border-[#EAECF2] pt-2">
                <span>Balance Due</span>
                <span className="font-mono tabular-nums">{formatINR(remaining)}</span>
              </div>
            </div>
          </div>

          {invPayments.length > 0 && (
            <div className="border-t border-[#EAECF2] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#717789] mb-2">
                Payment History
              </div>
              <div className="space-y-1 text-xs text-[#717789]">
                {invPayments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>
                      {formatFullDate(p.date)} · {p.method} ({p.reference})
                    </span>
                    <span className="font-mono tabular-nums font-medium text-[#171923]">
                      {formatINR(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
