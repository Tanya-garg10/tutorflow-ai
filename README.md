# TutorFlow AI — The One-Person Back Office

> **One tutor. One dashboard. Complete financial control.**  
> Built for **ACE BUILDERS Hackathon 2026 — Problem Statement 1: The One-Person Back Office**.

TutorFlow AI is a full-stack, AI-powered financial operations platform built specifically for independent home tutors and small coaching studios (10–100 students) operating in INR (`₹`) without accounting or administrative staff.

---

## Core Questions TutorFlow AI Answers

1. **Who owes me money?** — Live student ledger with paid, partial, pending, and overdue balances.
2. **How much money is overdue?** — Exact overdue totals and days past due per student and invoice.
3. **When should I follow up?** — Prioritized *Today's Priorities* & *AI Action Center* plus an English/Hindi AI Payment Follow-up Assistant.
4. **Will I have enough cash for the next 30–90 days?** — Deterministic 30/60/90-day cash flow engine separating confirmed cash from projected recurring tuition.
5. **What happens if an important student pays late?** — Interactive *What-If Scenario Simulator* (7/15/30-day delays + extra monthly expenses) showing exact shortfall dates and cash impact.

---

## Key Features

- **Intelligent Overview Dashboard**: Live KPI summary cards (Total Revenue, Collected, Outstanding, Overdue, Monthly Expenses, Available Cash), 4-month Revenue vs Expense & Collection Trend charts, Outstanding Invoice Breakdown, *Today's Priorities*, and an AI Financial Health Summary.
- **Student Management**: Full CRUD, search & status filters, monthly fee cadence, due day, notes, and individual student profile drawers with full invoice & payment history.
- **Invoice & Partial Payment Workflow**: Create/edit invoices with automatic numbering and discount calculation, track `Draft`, `Unpaid`, `Partially Paid`, `Paid`, and `Overdue` statuses, record full or partial payments (UPI, Bank Transfer, Cash, Card), and print/download receipts.
- **AI Payment Follow-up Assistant**: Generates personalized reminders in **English** or **Hindi** across 4 tones (*Polite*, *Friendly WhatsApp*, *Professional*, *Firm & Respectful*) using Gemini API (`gemini-4-hydrogen`) with a deterministic template fallback, editable draft area, clipboard copy, pre-filled `wa.me` WhatsApp link, and reminder history log.
- **Deterministic 30/60/90-Day Cash Forecast**: Combines current cash balance, expected invoice inflows, configurable collection rate assumptions, projected recurring tuition cycles, and scheduled/recurring expenses to highlight exact cash shortage dates and buffer risks.
- **What-If Scenario Simulator**: Test 7, 15, or 30-day payment delays on any open invoice (and optional new monthly expenses) with side-by-side baseline vs simulated cash curves, net impact metrics, and plain-language action plans.
- **AI Action Center**: Ranked operational queue (`Critical`, `High`, `Medium`, `Low`) with one-click navigation directly to the affected invoice, student, expense, or simulator.
- **TutorFlow Copilot**: Conversational financial assistant grounded strictly in live application data (never fabricates figures).
- **Expense Tracker & Settings**: Categorized recurring/one-time bills (`Rent`, `Electricity`, `Internet`, `Teaching materials`, `Salaries`, `Transportation`, `Miscellaneous`), studio UPI configuration, and one-click Demo Data reset.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, Motion (Framer Motion)
- **Backend**: Node.js, Express.js REST APIs (`/api/*`), persistent JSON ledger (`data/tutorflow-db.json` with client cache fallback)
- **AI**: Google Gemini API (`@google/genai` SDK, server-side only) with deterministic grounded fallbacks

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and add your Gemini API key (optional — if omitted, smart deterministic fallbacks remain active for reminders and Copilot):

```bash
cp .env.example .env
```

See `.env.example`:
```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"
```

### 3. Run in Development

```bash
npm run dev
```

The Express + Vite full-stack app runs on `http://localhost:3000`.

### 4. Production Build & Start

```bash
npm run build
NODE_ENV=production npm start
```

---

## Demo Data

The application preloads a realistic **Sample Demo Dataset** (clearly labeled in the header) featuring:
- 12 students across Classes 8–12 & JEE Foundation
- Historical paid invoices across 4 months
- 3+ overdue invoices (including **Rahul Sharma: ₹5,000 overdue by 12 days**)
- Partial payment examples (**Arjun Mehta** & **Meera Nair**)
- Upcoming recurring expenses (including **Monthly Rent: ₹8,000 due in 4 days**)
- Starting cash balance of **₹10,500** calibrated to demonstrate a cash shortfall when a key invoice is delayed by 15 days.

You can reset the demo dataset at any time under **Settings → Reset Demo Data**.
