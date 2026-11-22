import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Edit3,
  FilePlus2,
  Mail,
  Phone,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  AppDatabase,
  Invoice,
  Student,
  StudentWithMetrics,
} from '../../types/finance.ts';
import {
  computeStudentMetrics,
  deriveInvoiceStatus,
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
  getStudentNextDueDate,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { Modal } from '../ui/Modal.tsx';
import { StatusText } from '../ui/StatusText.tsx';

interface StudentsViewProps {
  db: AppDatabase;
  highlightedStudentId?: string | null;
  onCreateStudent: (payload: Omit<Student, 'id'>) => Promise<void>;
  onUpdateStudent: (id: string, payload: Partial<Student>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onOpenNewInvoiceForStudent: (studentId: string) => void;
  onOpenReminder: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
}

type SortKey = 'name' | 'outstanding' | 'dueDate';

export function StudentsView({
  db,
  highlightedStudentId,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
  onOpenNewInvoiceForStudent,
  onOpenReminder,
  onRecordPayment,
}: StudentsViewProps) {
  const todayStr = getTodayISO();
  const students = useMemo(() => computeStudentMetrics(db, todayStr), [db, todayStr]);

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'overdue' | 'pending' | 'partial' | 'paid' | 'paused'
  >('all');
  const [sortBy, setSortBy] = useState<SortKey>('outstanding');
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    highlightedStudentId ?? null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedStudentId) {
      setSelectedProfileId(highlightedStudentId);
    }
  }, [highlightedStudentId]);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState('Class 10');
  const [subject, setSubject] = useState('Mathematics');
  const [monthlyFee, setMonthlyFee] = useState(3500);
  const [joiningDate, setJoiningDate] = useState(todayStr);
  const [paymentDueDay, setPaymentDueDay] = useState(5);
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const uniqueGrades = useMemo(
    () => Array.from(new Set(db.students.map((s) => s.grade))).sort(),
    [db.students]
  );

  const openAdd = () => {
    setEditingStudent(null);
    setFullName('');
    setPhone('+91 ');
    setEmail('');
    setGrade('Class 10');
    setSubject('Mathematics');
    setMonthlyFee(3500);
    setJoiningDate(todayStr);
    setPaymentDueDay(5);
    setStatus('active');
    setNotes('');
    setFormOpen(true);
  };

  const openEdit = (stu: Student) => {
    setEditingStudent(stu);
    setFullName(stu.fullName);
    setPhone(stu.phone);
    setEmail(stu.email ?? '');
    setGrade(stu.grade);
    setSubject(stu.subject);
    setMonthlyFee(stu.monthlyFee);
    setJoiningDate(stu.joiningDate);
    setPaymentDueDay(stu.paymentDueDay);
    setStatus(stu.status);
    setNotes(stu.notes);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      const payload: Omit<Student, 'id'> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        grade: grade.trim(),
        subject: subject.trim(),
        monthlyFee: Number(monthlyFee) || 0,
        joiningDate,
        paymentDueDay: Math.min(28, Math.max(1, Number(paymentDueDay) || 5)),
        status,
        notes: notes.trim(),
      };
      if (editingStudent) {
        await onUpdateStudent(editingStudent.id, payload);
      } else {
        await onCreateStudent(payload);
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const enrichedWithNextDue = useMemo(() => {
    return students.map((s) => ({
      ...s,
      nextDueDate: getStudentNextDueDate(s.id, s.paymentDueDay, db.invoices, todayStr),
    }));
  }, [students, db.invoices, todayStr]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enrichedWithNextDue
      .filter((s) => {
        const matchesSearch =
          !q ||
          s.fullName.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q) ||
          s.grade.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q);
        const matchesGrade = gradeFilter === 'All' ? true : s.grade === gradeFilter;
        const matchesStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'paused'
              ? s.status === 'paused'
              : s.paymentStatus === statusFilter;
        return matchesSearch && matchesGrade && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
        if (sortBy === 'dueDate') return a.nextDueDate.localeCompare(b.nextDueDate);
        return (
          b.overdueBalance - a.overdueBalance ||
          b.outstandingBalance - a.outstandingBalance ||
          a.fullName.localeCompare(b.fullName)
        );
      });
  }, [enrichedWithNextDue, search, gradeFilter, statusFilter, sortBy]);

  const activeProfile: (StudentWithMetrics & { nextDueDate: string }) | null = selectedProfileId
    ? enrichedWithNextDue.find((s) => s.id === selectedProfileId) ?? null
    : null;

  const profileInvoices = activeProfile
    ? db.invoices.filter((i) => i.studentId === activeProfile.id)
    : [];
  const profilePayments = activeProfile
    ? db.payments.filter((p) => p.studentId === activeProfile.id)
    : [];

  const totalOutstanding = students.reduce((acc, s) => acc + s.outstandingBalance, 0);
  const activeCount = students.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
            Students
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Manage tuition schedules, fee balances, and payment histories.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors shadow-[0_2px_8px_rgba(114,87,232,0.25)] whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fintech-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#717789]">Total Students</div>
            <div className="text-xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
              {students.length}
            </div>
            <div className="text-[11px] text-[#717789] mt-0.5">{activeCount} active</div>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#F0ECFF] text-[#7257E8] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Total Outstanding Fees</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#E35454] mt-1">
            {formatINR(totalOutstanding)}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">
            Across {students.filter((s) => s.outstandingBalance > 0).length} students
          </div>
        </div>

        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Monthly Tuition Run-Rate</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#16A36A] mt-1">
            {formatINR(
              students.filter((s) => s.status === 'active').reduce((a, s) => a + s.monthlyFee, 0)
            )}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">Expected monthly recurring</div>
        </div>
      </section>

      {/* Filter & Sort Toolbar */}
      <div className="fintech-card p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#717789] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, subject, phone..."
              className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] pl-8 pr-3 py-2 text-xs text-[#171923] placeholder:text-[#717789] focus:outline-none focus:bg-white focus:border-[#7257E8]"
            />
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="Filter by class or grade"
            className="rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-xs font-medium text-[#171923] focus:outline-none focus:border-[#7257E8]"
          >
            <option value="All">All Classes</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Sort students"
            className="rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-xs font-medium text-[#171923] focus:outline-none focus:border-[#7257E8]"
          >
            <option value="outstanding">Sort: Highest Balance</option>
            <option value="dueDate">Sort: Next Due Date</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'partial', label: 'Partial' },
              { id: 'pending', label: 'Pending' },
              { id: 'paid', label: 'Paid' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-white text-[#7257E8] shadow-xs border border-[#EAECF2]'
                  : 'text-[#717789] hover:text-[#171923]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Students Table */}
      <div className="fintech-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EAECF2] text-[11px] font-semibold uppercase tracking-wider text-[#717789] bg-[#F7F8FC]/70">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class / Subject</th>
                <th className="py-3 px-4 text-right">Monthly Fee</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4">Next Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF2] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-[#717789]">
                    No students match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((stu) => (
                  <tr
                    key={stu.id}
                    className={`hover:bg-[#F7F8FC] transition-colors cursor-pointer ${
                      activeProfile?.id === stu.id ? 'bg-[#F0ECFF]/45' : ''
                    }`}
                    onClick={() => setSelectedProfileId(stu.id)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#171923]">{stu.fullName}</div>
                      <div className="text-xs text-[#717789]">{stu.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-[#171923]">{stu.grade}</div>
                      <div className="text-xs text-[#717789]">{stu.subject}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#171923]">
                      {formatINR(stu.monthlyFee)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#16A36A]">
                      {formatINR(stu.paidTotal)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums ${
                        stu.overdueBalance > 0
                          ? 'text-[#E35454]'
                          : stu.outstandingBalance > 0
                            ? 'text-[#4779E8]'
                            : 'text-[#717789]'
                      }`}
                    >
                      {formatINR(stu.outstandingBalance)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#717789] whitespace-nowrap">
                      {formatFullDate(stu.nextDueDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusText
                        status={stu.paymentStatus}
                        extraLabel={
                          stu.oldestOverdueDays > 0 ? `${stu.oldestOverdueDays}d` : undefined
                        }
                      />
                    </td>
                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenNewInvoiceForStudent(stu.id)}
                          title="Create invoice"
                          className="p-1.5 rounded-lg text-[#717789] hover:text-[#7257E8] hover:bg-[#F0ECFF] transition-colors"
                        >
                          <FilePlus2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(stu)}
                          title="Edit student"
                          className="p-1.5 rounded-lg text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === stu.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteStudent(stu.id);
                              setConfirmDeleteId(null);
                              if (selectedProfileId === stu.id) setSelectedProfileId(null);
                            }}
                            className="px-2 py-1 rounded-md text-xs font-semibold bg-[#E35454] text-white"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(stu.id)}
                            title="Delete student"
                            className="p-1.5 rounded-lg text-[#717789] hover:text-[#E35454] hover:bg-[#E35454]/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingStudent ? `Edit ${editingStudent.fullName}` : 'Add New Student'}
        subtitle="Track fee schedule, contact info, and payment history"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98201 00000"
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Class / Grade *
              </label>
              <input
                type="text"
                required
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Class 12 / JEE Foundation"
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Subject *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Monthly Fee (₹) *
              </label>
              <input
                type="number"
                min={0}
                required
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Monthly Due Day
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(Number(e.target.value))}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm font-mono tabular-nums text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">
                Joining Date
              </label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#717789] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:bg-white focus:border-[#7257E8]"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Batch timing, parent preferences, scholarship info..."
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
              {saving ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Slide-over Student Detail Panel */}
      <AnimatePresence>
        {activeProfile && (
          <div className="fixed inset-0 z-50 flex justify-end no-print">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfileId(null)}
              className="fixed inset-0 bg-[#171923]/30 backdrop-blur-[1px]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="relative w-full max-w-xl bg-white border-l border-[#EAECF2] shadow-[-12px_0_40px_rgba(23,25,35,0.1)] h-full flex flex-col z-10"
            >
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-[#EAECF2] flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-lg font-bold text-[#171923]">
                      {activeProfile.fullName}
                    </h2>
                    <StatusText status={activeProfile.paymentStatus} />
                  </div>
                  <p className="text-xs text-[#717789] mt-1">
                    {activeProfile.grade} · {activeProfile.subject} · Joined{' '}
                    {formatFullDate(activeProfile.joiningDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfileId(null)}
                  className="p-1.5 rounded-lg text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC]"
                  aria-label="Close student details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Financial Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs">
                  <div>
                    <div className="text-[#717789]">Monthly Fee</div>
                    <div className="text-sm font-mono font-bold tabular-nums text-[#171923] mt-0.5">
                      {formatINR(activeProfile.monthlyFee)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#717789]">Outstanding</div>
                    <div
                      className={`text-sm font-mono font-bold tabular-nums mt-0.5 ${
                        activeProfile.outstandingBalance > 0
                          ? 'text-[#E35454]'
                          : 'text-[#16A36A]'
                      }`}
                    >
                      {formatINR(activeProfile.outstandingBalance)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#717789]">Lifetime Paid</div>
                    <div className="text-sm font-mono font-bold tabular-nums text-[#16A36A] mt-0.5">
                      {formatINR(activeProfile.paidTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#717789]">Next Due</div>
                    <div className="text-sm font-medium text-[#171923] mt-0.5">
                      {formatFullDate(activeProfile.nextDueDate)}
                    </div>
                  </div>
                </div>

                {/* Personal Details & Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#717789]">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-[#171923]">
                      <Phone className="w-3.5 h-3.5 text-[#7257E8]" />
                      {activeProfile.phone}
                    </span>
                    {activeProfile.email && (
                      <span className="inline-flex items-center gap-1.5 text-[#171923]">
                        <Mail className="w-3.5 h-3.5 text-[#7257E8]" />
                        {activeProfile.email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(activeProfile)}
                      className="px-3 py-1.5 rounded-[9px] text-xs font-medium bg-[#F7F8FC] border border-[#EAECF2] text-[#171923] hover:border-[#7257E8]"
                    >
                      Edit Info
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfileId(null);
                        onOpenNewInvoiceForStudent(activeProfile.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6]"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      Create Invoice
                    </button>
                  </div>
                </div>

                {activeProfile.notes && (
                  <div className="p-3.5 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs text-[#171923]">
                    <span className="text-[#717789] font-semibold">Notes: </span>
                    {activeProfile.notes}
                  </div>
                )}

                {/* Invoice History */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717789] mb-2.5">
                    Invoice History ({profileInvoices.length})
                  </h3>
                  <div className="rounded-xl border border-[#EAECF2] overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F7F8FC] text-[#717789]">
                        <tr>
                          <th className="py-2.5 px-3">Invoice</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECF2]">
                        {profileInvoices.map((inv) => {
                          const st = deriveInvoiceStatus(inv, todayStr);
                          const rem = getInvoiceRemaining(inv);
                          return (
                            <tr key={inv.id} className="hover:bg-[#F7F8FC]">
                              <td className="py-2.5 px-3">
                                <div className="font-mono font-medium text-[#171923]">
                                  {inv.invoiceNumber}
                                </div>
                                <div className="text-[11px] text-[#717789]">{inv.billingMonth}</div>
                              </td>
                              <td className="py-2.5 px-3 text-[#717789]">
                                {formatFullDate(inv.dueDate)}
                              </td>
                              <td className="py-2.5 px-3">
                                <StatusText status={st} />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-[#171923]">
                                {formatINR(rem)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {rem > 0 && inv.status !== 'Draft' && (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onOpenReminder(inv)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors"
                                    >
                                      <Send className="w-3 h-3" />
                                      Remind
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRecordPayment(inv)}
                                      className="px-2 py-1 rounded-[8px] bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A] hover:text-white transition-colors"
                                    >
                                      Pay
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Timeline */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717789] mb-2.5">
                    Payment Timeline ({profilePayments.length})
                  </h3>
                  {profilePayments.length === 0 ? (
                    <p className="text-xs text-[#717789]">No payments recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {profilePayments.map((pay) => (
                        <div
                          key={pay.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs"
                        >
                          <div>
                            <div className="font-medium text-[#171923]">
                              {formatFullDate(pay.date)} · {pay.method}
                            </div>
                            <div className="text-[#717789] font-mono">{pay.reference}</div>
                          </div>
                          <span className="font-mono font-bold tabular-nums text-[#16A36A]">
                            +{formatINR(pay.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
