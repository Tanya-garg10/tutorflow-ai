import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Edit3,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import type {
  AppDatabase,
  Expense,
  ExpenseCategory,
} from '../../types/finance.ts';
import {
  formatFullDate,
  formatINR,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { addDaysISO } from '../../services/seedData.ts';
import { Modal } from '../ui/Modal.tsx';
import { StatusText } from '../ui/StatusText.tsx';

interface ExpensesViewProps {
  db: AppDatabase;
  highlightedExpenseId?: string | null;
  onCreateExpense: (payload: Omit<Expense, 'id'>) => Promise<void>;
  onUpdateExpense: (id: string, payload: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

const CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Electricity',
  'Internet',
  'Teaching materials',
  'Salaries',
  'Transportation',
  'Miscellaneous',
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Rent: '#7257E8',
  Electricity: '#EAA23B',
  Internet: '#4779E8',
  'Teaching materials': '#16A36A',
  Salaries: '#E35454',
  Transportation: '#6366F1',
  Miscellaneous: '#717789',
};

export function ExpensesView({
  db,
  highlightedExpenseId,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpensesViewProps) {
  const todayStr = getTodayISO();
  const [catFilter, setCatFilter] = useState<'All' | ExpenseCategory>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Upcoming' | 'Paid'>('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Rent');
  const [amount, setAmount] = useState(2000);
  const [dueDate, setDueDate] = useState(addDaysISO(todayStr, 5));
  const [isRecurring, setIsRecurring] = useState(true);
  const [frequency, setFrequency] = useState<Expense['frequency']>('monthly');
  const [status, setStatus] = useState<Expense['status']>('Upcoming');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setCategory('Teaching materials');
    setAmount(2000);
    setDueDate(addDaysISO(todayStr, 5));
    setIsRecurring(false);
    setFrequency('one-time');
    setStatus('Upcoming');
    setVendor('');
    setNotes('');
    setFormOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setTitle(exp.title);
    setCategory(exp.category);
    setAmount(exp.amount);
    setDueDate(exp.dueDate);
    setIsRecurring(exp.isRecurring);
    setFrequency(exp.frequency);
    setStatus(exp.status);
    setVendor(exp.vendor ?? '');
    setNotes(exp.notes ?? '');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: Omit<Expense, 'id'> = {
        title: title.trim(),
        category,
        amount: Number(amount) || 0,
        dueDate,
        isRecurring,
        frequency: isRecurring ? (frequency === 'one-time' ? 'monthly' : frequency) : 'one-time',
        status,
        paidDate: status === 'Paid' ? todayStr : undefined,
        vendor: vendor.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (editing) {
        await onUpdateExpense(editing.id, payload);
      } else {
        await onCreateExpense(payload);
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const upcomingTotal = db.expenses
    .filter((e) => e.status !== 'Paid')
    .reduce((acc, e) => acc + e.amount, 0);
  const recurringMonthlyTotal = db.expenses
    .filter((e) => e.isRecurring && e.status !== 'Paid')
    .reduce((acc, e) => acc + e.amount, 0);
  const paidTotal = db.expenses
    .filter((e) => e.status === 'Paid')
    .reduce((acc, e) => acc + e.amount, 0);

  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      category: cat,
      amount: db.expenses
        .filter((e) => e.category === cat)
        .reduce((acc, e) => acc + e.amount, 0),
      color: CATEGORY_COLORS[cat],
    }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [db.expenses]);

  const filtered = db.expenses
    .filter((e) => (catFilter === 'All' ? true : e.category === catFilter))
    .filter((e) => (statusFilter === 'All' ? true : e.status === statusFilter))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Paid' ? 1 : -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
            Expenses
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Track classroom rent, utilities, and teaching material bills feeding into cash forecasts.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors shadow-[0_2px_8px_rgba(114,87,232,0.25)] whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Summary Cards + Category Breakdown Chart */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-4">
          <div className="fintech-card p-4">
            <div className="text-xs font-medium text-[#717789]">Scheduled Upcoming Bills</div>
            <div className="text-xl font-display font-bold font-mono tabular-nums text-[#EAA23B] mt-1">
              {formatINR(upcomingTotal)}
            </div>
            <div className="text-[11px] text-[#717789] mt-0.5">
              Included in 30/60/90-day cash forecasts
            </div>
          </div>
          <div className="fintech-card p-4">
            <div className="text-xs font-medium text-[#717789]">Recurring Monthly Overhead</div>
            <div className="text-xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
              {formatINR(recurringMonthlyTotal)}
            </div>
            <div className="text-[11px] text-[#717789] mt-0.5">
              Rent, utilities, stipends &amp; commute
            </div>
          </div>
          <div className="fintech-card p-4">
            <div className="text-xs font-medium text-[#717789]">Paid Expenses</div>
            <div className="text-xl font-display font-bold font-mono tabular-nums text-[#16A36A] mt-1">
              {formatINR(paidTotal)}
            </div>
            <div className="text-[11px] text-[#717789] mt-0.5">Settled studio spend</div>
          </div>
        </div>

        <div className="xl:col-span-7 fintech-card p-5 flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="font-display font-semibold text-base text-[#171923]">
              Expense Category Breakdown
            </h2>
            <p className="text-xs text-[#717789]">
              Total scheduled and settled spend across studio categories
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryBreakdown}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EAECF2" vertical={false} />
                <XAxis
                  dataKey="category"
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
                <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} barSize={32}>
                  {categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="fintech-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as 'All' | ExpenseCategory)}
            className="rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-xs font-medium text-[#171923] focus:outline-none focus:border-[#7257E8]"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
            {(['All', 'Upcoming', 'Paid'] as const).map((tab) => (
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
      </div>

      {/* Expense Table */}
      <div className="fintech-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EAECF2] text-[11px] font-semibold uppercase tracking-wider text-[#717789] bg-[#F7F8FC]/70">
                <th className="py-3 px-4">Expense</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Cadence</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF2] text-sm">
              {filtered.map((exp) => {
                const isHighlighted = highlightedExpenseId === exp.id;
                return (
                  <tr
                    key={exp.id}
                    className={`transition-colors ${
                      isHighlighted ? 'bg-[#F0ECFF]/60' : 'hover:bg-[#F7F8FC]'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#171923]">{exp.title}</div>
                      {exp.vendor && (
                        <div className="text-xs text-[#717789]">{exp.vendor}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#171923]">{exp.category}</td>
                    <td className="py-3.5 px-4 text-xs text-[#717789] whitespace-nowrap">
                      {formatFullDate(exp.dueDate)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#717789]">
                      {exp.isRecurring ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0ECFF] text-[#7257E8] font-medium">
                          <Repeat className="w-3 h-3" />
                          {exp.frequency}
                        </span>
                      ) : (
                        'One-time'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusText status={exp.status === 'Paid' ? 'Paid' : 'Upcoming'} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-[#171923]">
                      {formatINR(exp.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {exp.status !== 'Paid' && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateExpense(exp.id, {
                                status: 'Paid',
                                paidDate: todayStr,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Paid
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(exp)}
                          className="p-1.5 rounded-lg text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC]"
                          title="Edit expense"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === exp.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteExpense(exp.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-md text-xs font-semibold bg-[#E35454] text-white"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(exp.id)}
                            className="p-1.5 rounded-lg text-[#717789] hover:text-[#E35454] hover:bg-[#E35454]/10"
                            title="Delete expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.title}` : 'Add Expense'}
        subtitle="Expenses feed directly into your 30/60/90-day cash flow forecast"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Expense Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Classroom Rent"
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Payment / Due Date
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Expense['status'])}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              >
                <option value="Upcoming">Upcoming (Scheduled)</option>
                <option value="Paid">Paid (Deduct from cash now)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F8FC] border border-[#EAECF2]">
            <label className="inline-flex items-center gap-2 text-xs text-[#171923] cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="accent-[#7257E8]"
              />
              Recurring scheduled expense
            </label>
            {isRecurring && (
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Expense['frequency'])}
                className="rounded-lg bg-white border border-[#EAECF2] px-2.5 py-1 text-xs text-[#171923]"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Vendor / Payee (optional)
            </label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Landlord, MSEDCL, Print Shop"
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-[#EAECF2]">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-[10px] text-xs font-medium text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
