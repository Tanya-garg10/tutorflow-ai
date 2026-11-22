export type NavSection =
  | 'overview'
  | 'students'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'forecast'
  | 'simulator'
  | 'action-center'
  | 'copilot'
  | 'settings';

export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';

export type PaymentMethod = 'UPI' | 'Bank Transfer' | 'Cash' | 'Card';

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity'
  | 'Internet'
  | 'Teaching materials'
  | 'Salaries'
  | 'Transportation'
  | 'Miscellaneous';

export type ExpenseStatus = 'Paid' | 'Upcoming' | 'Overdue';

export type ReminderTone = 'polite' | 'friendly_whatsapp' | 'professional' | 'firm';
export type ReminderLanguage = 'English' | 'Hindi';
export type FollowUpStatus =
  | 'Drafted'
  | 'Copied'
  | 'Opened in WhatsApp'
  | 'Follow-up Scheduled';

export interface UserProfile {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  upiId: string;
  currency: 'INR';
  openingCashBalance: number;
  collectionAssumptionPercent: number;
  includeRecurringTuitionInForecast: boolean;
  safetyBufferAmount: number;
  demoMode: boolean;
  avatarUrl: string;
}

export interface Student {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  grade: string;
  subject: string;
  monthlyFee: number;
  joiningDate: string;
  paymentDueDay: number;
  status: 'active' | 'paused';
  notes: string;
  isDemo?: boolean;
}

export interface InvoiceLineItem {
  label: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  issueDate: string;
  dueDate: string;
  expectedPaymentDate: string;
  description: string;
  billingMonth: string;
  amount: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  lineItems?: InvoiceLineItem[];
  isRecurring?: boolean;
  isDemo?: boolean;
}

export interface Payment {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  notes?: string;
  isDemo?: boolean;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  dueDate: string;
  isRecurring: boolean;
  frequency: 'monthly' | 'quarterly' | 'one-time';
  status: ExpenseStatus;
  paidDate?: string;
  vendor?: string;
  notes?: string;
  isDemo?: boolean;
}

export interface Reminder {
  id: string;
  invoiceId: string;
  studentId: string;
  channel: 'WhatsApp' | 'Email' | 'SMS' | 'Manual';
  tone: ReminderTone;
  language: ReminderLanguage;
  message: string;
  createdAt: string;
  followUpStatus: FollowUpStatus;
  note?: string;
}

export interface Scenario {
  id: string;
  name: string;
  invoiceId: string;
  delayDays: number;
  revisedExpectedDate: string;
  extraMonthlyExpense: number;
  createdAt: string;
}

export interface AppDatabase {
  user: UserProfile;
  students: Student[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  reminders: Reminder[];
  scenarios: Scenario[];
  lastResetAt: string;
}

export interface StudentWithMetrics extends Student {
  outstandingBalance: number;
  overdueBalance: number;
  paidTotal: number;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'partial';
  oldestOverdueDays: number;
  invoiceCount: number;
}

export interface ForecastPoint {
  date: string;
  label: string;
  dayOffset: number;
  confirmedBalance: number;
  projectedBalance: number;
  inflow: number;
  outflow: number;
  events: string[];
}

export interface ShortageDate {
  date: string;
  label: string;
  projectedBalance: number;
  shortfallAmount: number;
  cause: string;
}

export interface CashFlowForecast {
  horizonDays: 30 | 60 | 90;
  currentCash: number;
  confirmedReceivables: number;
  projectedRecurringIncome: number;
  totalExpectedIncome: number;
  totalExpectedExpenses: number;
  projectedClosingBalance: number;
  confirmedClosingBalance: number;
  lowestBalance: { date: string; label: string; amount: number };
  shortageDates: ShortageDate[];
  healthIndicator: 'Healthy' | 'Tight' | 'At Risk';
  timeline: ForecastPoint[];
}

export interface SimulationResult {
  horizonDays: 30 | 60 | 90;
  baseline: CashFlowForecast;
  simulated: CashFlowForecast;
  closingBalanceDiff: number;
  lowestBalanceDiff: number;
  newlyCreatedShortages: ShortageDate[];
  explanation: string;
  suggestedActions: string[];
  comparisonSeries: Array<{
    date: string;
    label: string;
    baselineBalance: number;
    simulatedBalance: number;
  }>;
}

export interface ActionItem {
  id: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category:
    | 'overdue_invoice'
    | 'due_soon'
    | 'upcoming_expense'
    | 'cash_shortage'
    | 'draft_invoice'
    | 'partial_followup';
  title: string;
  reason: string;
  amount: number;
  deadline: string;
  daysDelta: number;
  recommendedAction: string;
  actionLabel: string;
  targetView: NavSection;
  targetId: string;
}

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  collected: number;
  expenses: number;
  net: number;
}

export interface DashboardSummary {
  totalRevenue: number;
  collectedPayments: number;
  outstandingPayments: number;
  overduePayments: number;
  monthlyExpenses: number;
  availableCash: number;
  collectionRate: number;
  overdueInvoiceCount: number;
  unpaidStudentCount: number;
  monthlyTrends: MonthlyTrendPoint[];
  outstandingBreakdown: Array<{
    name: string;
    value: number;
    count: number;
    color: string;
  }>;
}
