# 🎓 TutorFlow AI — The One-Person Back Office

> **One tutor. One dashboard. Complete financial control.**  
> Built for independent home tutors and small coaching studios (10–100 students) operating in INR (₹) without accounting or administrative staff.

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4-black.svg?logo=express)](https://expressjs.com/)
[![Gemini](https://img.shields.io/badge/Gemini_API-2.5_Flash-orange.svg?logo=google)](https://ai.google.dev/)

## 📌 Problem Statement

Independent tutors in India spend hours juggling Excel sheets, registers, and WhatsApp chats to track tuition fees. Without dedicated accounting staff, they struggle with:
- Unpaid & overdue fees slipping through the cracks.
- Awkward and repetitive payment follow-ups with parents.
- Sudden cash shortages when key students pay late and bills (rent, electricity, salaries) come due.
- No forecasting tools to answer: *"Can I afford this new expense next month?"*

**TutorFlow AI** solves this with an intuitive, unified financial dashboard powered by deterministic cash modeling and AI assistants.

## 💡 The 5 Core Questions TutorFlow AI Answers

| # | Question | How TutorFlow AI Solves It |
|---|---|---|
| 1 | **Who owes me money?** | Live student fee ledger with real-time tracking of paid, partial, pending, and overdue balances. |
| 2 | **How much money is overdue?** | Exact overdue totals and days-past-due metrics calculated per student and invoice. |
| 3 | **When should I follow up?** | Prioritized **Action Center** + bilingual **AI Payment Reminder Assistant** (English & Hindi) with 1-click WhatsApp links. |
| 4 | **Will I have enough cash for the next 30–90 days?** | Deterministic 30/60/90-day cash flow engine separating confirmed cash from projected recurring tuition. |
| 5 | **What happens if a student pays late?** | Interactive **What-If Scenario Simulator** (7/15/30-day payment delays + added expenses) showing exact shortfall dates and cash curves. |

## 🚀 Key Features

### 📊 1. Intelligent Overview Dashboard
- **Live KPI Summary Cards**: Total Revenue, Collected Fees, Outstanding Balance, Overdue Amount, Monthly Expenses, and Available Cash.
- **Visual Analytics**: 4-month Revenue vs. Expense comparisons and collection trend charts (powered by Recharts).
- **AI Financial Health Summary**: Instant executive briefing highlighting cash buffers and urgent risks.

### 👥 2. Student & Fee Management
- Complete student registry with class, grade, subject, contact info, monthly fee cadence, and custom due dates.
- Individual student profile drawers with lifetime billing history, payments made, and current fee status.

### 🧾 3. Invoicing & Partial Payment Tracking
- Auto-generated invoice numbering with itemized billing and custom discounts.
- Comprehensive status tracking: `Draft`, `Unpaid`, `Partially Paid`, `Paid`, and `Overdue`.
- Flexible multi-mode payments (UPI, Bank Transfer, Cash, Card) with printable payment receipts.

### 💬 4. AI Payment Reminder Assistant
- Powered by Google Gemini with deterministic offline templates as a resilient fallback.
- **Multilingual**: Native English and Devanagari Hindi.
- **4 Custom Tones**: *Polite*, *Friendly WhatsApp*, *Professional*, and *Firm & Respectful*.
- One-click copy and pre-filled `wa.me` WhatsApp direct messaging links.

### 🔮 5. Deterministic 30/60/90-Day Cash Forecast
- Projects cash balance across 30, 60, and 90-day horizons.
- Differentiates between hard receivables (invoiced) and expected recurring tuition cycles.
- Identifies specific low-balance days and cash shortfall dates before expenses hit.

### 🧪 6. What-If Scenario Simulator
- Stress-test your cash flow against unexpected payment delays (7, 15, or 30 days) on any open invoice.
- Test new recurring studio expenses to verify affordability before committing.
- Visual side-by-side comparison of baseline vs. simulated cash curves.

### ⚡ 7. AI Action Center & Copilot
- **Action Center**: Prioritized operational tasks (`Critical`, `High`, `Medium`, `Low`) with quick-action shortcuts.
- **TutorFlow Copilot**: AI conversational assistant strictly grounded in your studio's live financial data—no hallucinations, only verified numbers.
  
## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, Motion (Framer Motion)
- **Backend**: Node.js, Express.js REST API (`/api/*`), tsx runner
- **Database / Storage**: Persistent JSON file-based database (`data/tutorflow-db.json`) with client-side state synchronization
- **AI Engine**: Google Gemini API (`@google/genai` SDK) with robust deterministic fallbacks

## 📁 Project Structure

```text
tutorflow-ai/
├── data/                    # JSON database storage
│   └── tutorflow-db.json
├── server/                  # Backend modules
│   └── ai.ts                # Gemini API prompts, grounding & fallback engine
├── src/
│   ├── assets/              # Images, avatars, icons
│   ├── components/
│   │   ├── modals/          # Payment reminders, invoices, receipts modals
│   │   ├── ui/              # Reusable UI widgets (cards, badges, modals, toasts)
│   │   └── views/           # Dashboard, Students, Invoices, Expenses, Copilot, etc.
│   ├── services/
│   │   ├── api.ts           # REST API client
│   │   ├── financeEngine.ts # Deterministic financial calculations & forecasting
│   │   └── seedData.ts      # Sample realistic demo dataset
│   ├── types/
│   │   └── finance.ts       # TypeScript definitions and data interfaces
│   ├── App.tsx              # Application root
│   ├── main.tsx             # React entry point
│   └── index.css            # Tailwind CSS v4 styling
├── .env.example             # Environment variable template
├── package.json             # Scripts and dependencies
├── server.ts                # Express backend server
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build configuration
```

## ⚡ Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

### 1. Clone the Repository
```bash
git clone https://github.com/Tanya-garg10/tutorflow-ai.git
cd tutorflow-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Open `.env` and set your credentials:
```env
PORT=3000
GEMINI_API_KEY="your-gemini-api-key-here"
```

> **Note**: An API key is optional! If no key is provided, TutorFlow AI gracefully switches to its smart deterministic offline templates for reminders, health summaries, and Copilot queries.

### 4. Run the Development Server
```bash
npm run dev
```

Visit **`http://localhost:3000`** in your browser. The Express server and Vite frontend run together in one seamless process!

### 5. Production Build
```bash
npm run build
npm start
```

## 🧪 Realistic Demo Data Included

TutorFlow AI comes pre-configured with a realistic sample dataset to explore all features instantly:
- **12 Students** across Classes 8–12 and competitive prep (JEE/NEET).
- **Historical Invoices & Payments** spanning the past 4 months.
- **Overdue Invoices** (e.g., *Rahul Sharma: ₹5,000 overdue by 12 days*).
- **Upcoming Studio Bills** (e.g., *Monthly Rent: ₹8,000 due in 4 days*).
- **Configured Starting Cash** (₹10,500) calibrated to showcase shortfall simulations when fees are delayed.

*You can restore this dataset at any time via **Settings → Reset Demo Data**.*

## 📄 License

This project is licensed under the [MIT License](LICENSE).
