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
  UserProfile,
} from '../types/finance.ts';
import { createDemoDatabase } from './seedData.ts';

const LOCAL_CACHE_KEY = 'tutorflow_ai_db_cache_v1';

async function requestJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function cacheDatabaseLocally(db: AppDatabase): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(db));
  } catch {
    // ignore storage quota errors
  }
}

export function loadLocalCache(): AppDatabase | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppDatabase;
  } catch {
    return null;
  }
}

export const api = {
  async getState(): Promise<AppDatabase> {
    try {
      const db = await requestJSON<AppDatabase>('/api/state');
      cacheDatabaseLocally(db);
      return db;
    } catch {
      const cached = loadLocalCache();
      if (cached) return cached;
      const seed = createDemoDatabase();
      cacheDatabaseLocally(seed);
      return seed;
    }
  },

  async resetDemo(): Promise<AppDatabase> {
    const db = await requestJSON<AppDatabase>('/api/reset-demo', { method: 'POST' });
    cacheDatabaseLocally(db);
    return db;
  },

  async updateSettings(payload: Partial<UserProfile>): Promise<UserProfile> {
    return requestJSON<UserProfile>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async createStudent(payload: Omit<Student, 'id'>): Promise<Student> {
    return requestJSON<Student>('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateStudent(id: string, payload: Partial<Student>): Promise<Student> {
    return requestJSON<Student>(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteStudent(id: string): Promise<void> {
    await requestJSON<{ deleted: boolean }>(`/api/students/${id}`, {
      method: 'DELETE',
    });
  },

  async createInvoice(payload: {
    studentId: string;
    invoiceNumber?: string;
    issueDate: string;
    dueDate: string;
    expectedPaymentDate: string;
    description: string;
    billingMonth: string;
    amount: number;
    discount: number;
    status?: 'Draft' | 'Unpaid';
    isRecurring?: boolean;
  }): Promise<Invoice> {
    return requestJSON<Invoice>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateInvoice(id: string, payload: Partial<Invoice>): Promise<Invoice> {
    return requestJSON<Invoice>(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteInvoice(id: string): Promise<void> {
    await requestJSON<{ deleted: boolean }>(`/api/invoices/${id}`, {
      method: 'DELETE',
    });
  },

  async recordPayment(payload: {
    invoiceId: string;
    amount: number;
    date: string;
    method: Payment['method'];
    reference?: string;
    notes?: string;
  }): Promise<{ payment: Payment; invoice: Invoice; openingCashBalance: number }> {
    return requestJSON('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createExpense(
    payload: Omit<Expense, 'id'>
  ): Promise<{ expense: Expense; openingCashBalance: number }> {
    return requestJSON('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateExpense(
    id: string,
    payload: Partial<Expense>
  ): Promise<{ expense: Expense; openingCashBalance: number }> {
    return requestJSON(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteExpense(id: string): Promise<void> {
    await requestJSON<{ deleted: boolean }>(`/api/expenses/${id}`, {
      method: 'DELETE',
    });
  },

  async saveReminder(payload: {
    invoiceId: string;
    channel: Reminder['channel'];
    tone: ReminderTone;
    language: ReminderLanguage;
    message: string;
    followUpStatus: Reminder['followUpStatus'];
    note?: string;
  }): Promise<Reminder> {
    return requestJSON<Reminder>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async saveScenario(payload: {
    name: string;
    invoiceId: string;
    delayDays: number;
    revisedExpectedDate: string;
    extraMonthlyExpense: number;
  }): Promise<Scenario> {
    return requestJSON<Scenario>('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async generateAIReminder(payload: {
    invoiceId: string;
    tone: ReminderTone;
    language: ReminderLanguage;
  }): Promise<{ message: string; source: 'gemini' | 'template' }> {
    return requestJSON('/api/ai/reminder', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async askCopilot(payload: {
    question: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{ answer: string; source: 'gemini' | 'grounded-engine' }> {
    return requestJSON('/api/ai/copilot', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getHealthSummary(): Promise<{
    summaryText: string;
    source: 'gemini' | 'grounded-engine';
  }> {
    return requestJSON('/api/ai/health-summary');
  },
};
