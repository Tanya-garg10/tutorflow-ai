import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
} from 'lucide-react';
import type { ActionItem } from '../../types/finance.ts';
import { formatFullDate, formatINR } from '../../services/financeEngine.ts';

interface ActionCenterViewProps {
  actions: ActionItem[];
  onActionClick: (action: ActionItem) => void;
}

const COMPLETED_STORAGE_KEY = 'tutorflow_completed_actions_v1';

export function ActionCenterView({ actions, onActionClick }: ActionCenterViewProps) {
  const [groupFilter, setGroupFilter] = useState<
    'All' | 'Urgent' | 'Today' | 'Upcoming' | 'Completed'
  >('All');

  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(COMPLETED_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(completedIds));
    } catch {
      // ignore storage errors
    }
  }, [completedIds]);

  const toggleCompleted = (id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const completedSet = new Set(completedIds);

  const urgentItems = actions.filter(
    (a) => !completedSet.has(a.id) && (a.priority === 'Critical' || a.priority === 'High')
  );
  const todayItems = actions.filter(
    (a) =>
      !completedSet.has(a.id) &&
      a.priority !== 'Critical' &&
      a.priority !== 'High' &&
      a.daysDelta <= 2
  );
  const upcomingItems = actions.filter(
    (a) =>
      !completedSet.has(a.id) &&
      a.priority !== 'Critical' &&
      a.priority !== 'High' &&
      a.daysDelta > 2
  );
  const completedItems = actions.filter((a) => completedSet.has(a.id));

  const totalAtStake = actions
    .filter((a) => !completedSet.has(a.id))
    .reduce((acc, a) => acc + a.amount, 0);

  const groups = [
    { id: 'Urgent' as const, label: 'Urgent', items: urgentItems, tone: 'text-[#E35454]' },
    { id: 'Today' as const, label: 'Today', items: todayItems, tone: 'text-[#EAA23B]' },
    { id: 'Upcoming' as const, label: 'Upcoming', items: upcomingItems, tone: 'text-[#4779E8]' },
    { id: 'Completed' as const, label: 'Completed', items: completedItems, tone: 'text-[#16A36A]' },
  ].filter((g) => (groupFilter === 'All' ? g.items.length > 0 : g.id === groupFilter));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
          AI Action Center
        </h1>
        <p className="text-sm text-[#717789] mt-0.5">
          Prioritized daily tasks across overdue fees, upcoming bills, and cash flow alerts.
        </p>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Urgent Actions</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#E35454] mt-1">
            {urgentItems.length} Tasks
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">
            Critical &amp; high-priority follow-ups
          </div>
        </div>
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Total Value at Stake</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#171923] mt-1">
            {formatINR(totalAtStake)}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">
            Pending fees &amp; upcoming cash obligations
          </div>
        </div>
        <div className="fintech-card p-4">
          <div className="text-xs font-medium text-[#717789]">Completed Today</div>
          <div className="text-xl font-display font-bold font-mono tabular-nums text-[#16A36A] mt-1">
            {completedItems.length} of {actions.length}
          </div>
          <div className="text-[11px] text-[#717789] mt-0.5">
            Check off tasks as you resolve them
          </div>
        </div>
      </section>

      {/* Group Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[10px] bg-white border border-[#EAECF2]">
          {(['All', 'Urgent', 'Today', 'Upcoming', 'Completed'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                groupFilter === g
                  ? 'bg-[#F0ECFF] text-[#7257E8]'
                  : 'text-[#717789] hover:text-[#171923]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Task Sections */}
      {groups.length === 0 ? (
        <div className="fintech-card p-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#16A36A] mx-auto" />
          <div className="text-sm font-semibold text-[#171923]">No tasks in this view</div>
          <p className="text-xs text-[#717789]">
            Everything in this category is resolved.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.id} className="fintech-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#EAECF2] bg-[#F7F8FC]/60 flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${group.tone}`}>
                  {group.label} ({group.items.length})
                </span>
              </div>

              <div className="divide-y divide-[#EAECF2]">
                {group.items.map((item) => {
                  const isDone = completedSet.has(item.id);
                  const colorClass =
                    item.priority === 'Critical'
                      ? 'text-[#E35454]'
                      : item.priority === 'High'
                        ? 'text-[#EAA23B]'
                        : 'text-[#4779E8]';

                  const Icon =
                    item.priority === 'Critical'
                      ? AlertTriangle
                      : item.category === 'upcoming_expense'
                        ? CalendarClock
                        : BellRing;

                  return (
                    <div
                      key={item.id}
                      className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isDone ? 'bg-[#F7F8FC]/50 opacity-75' : 'hover:bg-[#F7F8FC]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleCompleted(item.id)}
                          aria-label={isDone ? 'Mark task incomplete' : 'Mark task complete'}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isDone
                              ? 'bg-[#16A36A] border-[#16A36A] text-white'
                              : 'bg-white border-[#D6DAE6] hover:border-[#7257E8]'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5" />}
                        </button>

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
                            <span className={`font-semibold ${colorClass}`}>{item.priority}</span>
                            <span className="text-[#D6DAE6]">·</span>
                            <span className="font-mono tabular-nums text-[#171923] font-semibold">
                              {formatINR(item.amount)}
                            </span>
                            <span className="text-[#D6DAE6]">·</span>
                            <span className="text-[#717789]">
                              Deadline {formatFullDate(item.deadline)}
                            </span>
                          </div>

                          <h3
                            className={`text-sm font-semibold ${
                              isDone ? 'line-through text-[#717789]' : 'text-[#171923]'
                            }`}
                          >
                            {item.title}
                          </h3>
                          <p className="text-xs text-[#717789] leading-relaxed">{item.reason}</p>
                          <p className="text-xs font-medium text-[#7257E8]">
                            Next step: {item.recommendedAction}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onActionClick(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors whitespace-nowrap shrink-0 self-start lg:self-center"
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
