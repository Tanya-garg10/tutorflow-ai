import { useState } from 'react';
import { CheckCircle2, IndianRupee, Plus, Search } from 'lucide-react';
import type { AppDatabase, Invoice, PaymentMethod } from '../../types/finance.ts';
import {
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
} from '../../services/financeEngine.ts';
import { Modal } from '../ui/Modal.tsx';

interface PaymentsViewProps {
  db: AppDatabase;
  onRecordPayment: (invoice: Invoice) => void;
}

export function PaymentsView({ db, onRecordPayment }: PaymentsViewProps) {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'All' | PaymentMethod>('All');
  const [pickInvoiceOpen, setPickInvoiceOpen] = useState(false);

  const studentMap = new Map(db.students.map((s) => [s.id, s]));
  const invoiceMap = new Map(db.invoices.map((i) => [i.id, i]));

  const openInvoices = db.invoices.filter(
    (inv) => inv.status !== 'Draft' && getInvoiceRemaining(inv) > 0
  );

  const filtered = db.payments.filter((pay) => {
    const stuName = studentMap.get(pay.studentId)?.fullName.toLowerCase() ?? '';
    const invNum = invoiceMap.get(pay.invoiceId)?.invoiceNumber.toLowerCase() ?? '';
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      stuName.includes(q) ||
      invNum.includes(q) ||
      pay.reference.toLowerCase().includes(q);
    const matchesMethod = methodFilter === 'All' ? true : pay.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const totalsByMethod = (['UPI', 'Bank Transfer', 'Cash', 'Card'] as PaymentMethod[]).map(
    (m) => ({
      method: m,
      total: db.payments
        .filter((p) => p.method === m)
        .reduce((acc, p) => acc + p.amount, 0),
      count: db.payments.filter((p) => p.method === m).length,
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
            Payments
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Complete history of UPI, bank transfer, cash, and card fee receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickInvoiceOpen(true)}
          disabled={openInvoices.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-semibold bg-[#16A36A] text-white hover:bg-[#138A58] transition-colors disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Method Breakdown Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {totalsByMethod.map((m) => (
          <div key={m.method} className="fintech-card p-4">
            <div className="text-xs font-medium text-[#717789]">{m.method}</div>
            <div className="text-xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
              {formatINR(m.total)}
            </div>
            <div className="text-[11px] text-[#717789] mt-0.5">
              {m.count} payment{m.count === 1 ? '' : 's'}
            </div>
          </div>
        ))}
      </section>

      {/* Toolbar */}
      <div className="fintech-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#717789] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, invoice #, reference..."
            className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] pl-8 pr-3 py-2 text-xs text-[#171923] placeholder:text-[#717789] focus:outline-none focus:bg-white focus:border-[#7257E8]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
          {(['All', 'UPI', 'Bank Transfer', 'Cash', 'Card'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMethodFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                methodFilter === tab
                  ? 'bg-white text-[#7257E8] shadow-xs border border-[#EAECF2]'
                  : 'text-[#717789] hover:text-[#171923]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="fintech-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EAECF2] text-[11px] font-semibold uppercase tracking-wider text-[#717789] bg-[#F7F8FC]/70">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Method &amp; Reference</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF2] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#717789]">
                    No payment records match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((pay) => {
                  const stu = studentMap.get(pay.studentId);
                  const inv = invoiceMap.get(pay.invoiceId);
                  return (
                    <tr key={pay.id} className="hover:bg-[#F7F8FC] transition-colors">
                      <td className="py-3.5 px-4 text-xs text-[#717789] whitespace-nowrap">
                        {formatFullDate(pay.date)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#171923]">
                        {stu?.fullName ?? 'Student'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#7257E8] font-medium">
                        {inv?.invoiceNumber ?? '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#171923]">
                        {pay.method} ·{' '}
                        <span className="font-mono text-[#717789]">{pay.reference}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#717789]">
                        {pay.notes ?? 'Tuition receipt'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-[#16A36A]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          +{formatINR(pay.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pick Open Invoice Modal */}
      <Modal
        open={pickInvoiceOpen}
        onClose={() => setPickInvoiceOpen(false)}
        title="Select Open Invoice to Record Payment"
        subtitle="Choose an unpaid or partially paid invoice"
      >
        <div className="divide-y divide-[#EAECF2]">
          {openInvoices.map((inv) => {
            const stu = studentMap.get(inv.studentId);
            const rem = getInvoiceRemaining(inv);
            return (
              <div
                key={inv.id}
                className="py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-medium text-[#171923]">
                    {stu?.fullName ?? 'Student'} ·{' '}
                    <span className="font-mono text-xs text-[#7257E8]">
                      {inv.invoiceNumber}
                    </span>
                  </div>
                  <div className="text-xs text-[#717789]">
                    Due {formatFullDate(inv.dueDate)} · Paid {formatINR(inv.paidAmount)} of{' '}
                    {formatINR(inv.totalAmount)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPickInvoiceOpen(false);
                    onRecordPayment(inv);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors shrink-0"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  {formatINR(rem)}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
