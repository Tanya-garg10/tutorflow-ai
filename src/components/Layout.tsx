import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  IndianRupee,
  Receipt,
  TrendingUp,
  SlidersHorizontal,
  BellRing,
  Bot,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Plus,
  Search,
  Bell,
  HelpCircle,
  ChevronRight,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import type {
  ActionItem,
  AppDatabase,
  NavSection,
} from '../types/finance.ts';
import { formatINR } from '../services/financeEngine.ts';
import { Modal } from './ui/Modal.tsx';

interface LayoutProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  db: AppDatabase;
  actions: ActionItem[];
  overdueCount: number;
  onNewInvoice: () => void;
  onActionClick: (action: ActionItem) => void;
  onJumpToStudent: (studentId: string) => void;
  onJumpToInvoice: (invoiceId: string) => void;
  onResetDemo: () => Promise<void>;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: IndianRupee },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'forecast', label: 'Cash Flow', icon: TrendingUp },
  { id: 'simulator', label: 'What-if Simulator', icon: SlidersHorizontal },
  { id: 'action-center', label: 'AI Action Center', icon: BellRing },
  { id: 'copilot', label: 'TutorFlow Copilot', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Layout({
  activeNav,
  onSelectNav,
  db,
  actions,
  overdueCount,
  onNewInvoice,
  onActionClick,
  onJumpToStudent,
  onJumpToInvoice,
  onResetDemo,
  children,
}: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Top bar interactive states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentItem = NAV_ITEMS.find((n) => n.id === activeNav) ?? NAV_ITEMS[0];
  const user = db.user;

  // Global search results
  const q = searchQuery.trim().toLowerCase();
  const matchedStudents = q
    ? db.students
        .filter(
          (s) =>
            s.fullName.toLowerCase().includes(q) ||
            s.subject.toLowerCase().includes(q) ||
            s.grade.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];
  const matchedInvoices = q
    ? db.invoices
        .filter((inv) => {
          const stu = db.students.find((s) => s.id === inv.studentId);
          return (
            inv.invoiceNumber.toLowerCase().includes(q) ||
            inv.description.toLowerCase().includes(q) ||
            (stu?.fullName.toLowerCase().includes(q) ?? false)
          );
        })
        .slice(0, 4)
    : [];

  const renderBrand = (showText: boolean) => (
    <button
      type="button"
      onClick={() => onSelectNav('overview')}
      className="flex items-center gap-2.5 text-left min-w-0 group"
    >
      <div className="w-8 h-8 rounded-[10px] bg-[#7257E8] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(114,87,232,0.28)]">
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h16" />
          <path d="M12 7v11" />
          <path d="M8 14l4 4 7-7" />
        </svg>
      </div>
      {showText && (
        <div className="min-w-0">
          <div className="font-display font-bold text-[15px] tracking-tight text-[#171923] whitespace-nowrap">
            TutorFlow <span className="text-[#7257E8]">AI</span>
          </div>
        </div>
      )}
    </button>
  );

  const renderNavList = (isMobile = false) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeNav === item.id;
        const countHint =
          item.id === 'action-center' && actions.length > 0
            ? actions.length
            : item.id === 'invoices' && overdueCount > 0
              ? overdueCount
              : null;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectNav(item.id);
              if (isMobile) setMobileOpen(false);
            }}
            title={collapsed && !isMobile ? item.label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-[#F0ECFF] text-[#7257E8]'
                : 'text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC]'
            }`}
          >
            <Icon
              className={`w-[17px] h-[17px] shrink-0 ${
                isActive ? 'text-[#7257E8]' : 'text-[#717789]'
              }`}
            />
            {(!collapsed || isMobile) && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {countHint !== null && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-medium ${
                      item.id === 'invoices'
                        ? 'bg-[#E35454]/10 text-[#E35454]'
                        : 'bg-[#7257E8]/12 text-[#7257E8]'
                    }`}
                  >
                    {countHint}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );

  const renderAvatar = (size = 'w-9 h-9') =>
    user.avatarUrl && !avatarFailed ? (
      <img
        src={user.avatarUrl}
        alt={user.name}
        referrerPolicy="no-referrer"
        onError={() => setAvatarFailed(true)}
        className={`${size} rounded-full object-cover shrink-0 border border-[#EAECF2]`}
      />
    ) : (
      <div
        className={`${size} rounded-full bg-[#F0ECFF] border border-[#7257E8]/25 flex items-center justify-center text-xs font-semibold text-[#7257E8] shrink-0`}
      >
        {user.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)}
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#171923] flex pb-16 md:pb-0">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[#EAECF2] transition-[width] duration-200 sticky top-0 h-screen no-print ${
          collapsed ? 'w-[76px]' : 'w-[248px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#EAECF2]">
          {renderBrand(!collapsed)}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-[9px] text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] transition-colors shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {renderNavList(false)}

        <div className="p-3 border-t border-[#EAECF2]">
          <button
            type="button"
            onClick={() => onSelectNav('settings')}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#F7F8FC] transition-colors text-left"
          >
            {renderAvatar('w-9 h-9')}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#171923] truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-[#717789] truncate">
                  {user.businessName}
                </div>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-[#171923]/30 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white border-r border-[#EAECF2] flex flex-col h-full z-10 shadow-xl">
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#EAECF2]">
              {renderBrand(true)}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-[#717789] hover:text-[#171923]"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderNavList(true)}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 border-b border-[#EAECF2] bg-white/90 backdrop-blur-xs sticky top-0 z-30 no-print">
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-[9px] text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] transition-colors shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <button
                type="button"
                onClick={() => onSelectNav('overview')}
                className="text-[#717789] hover:text-[#171923] hidden sm:inline whitespace-nowrap transition-colors"
              >
                TutorFlow AI
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-[#717789] hidden sm:inline shrink-0" />
              <span className="font-display font-semibold text-[#171923] truncate">
                {currentItem.label}
              </span>
            </div>
          </div>

          {/* Right: Search + Notifications + Help + Avatar + Primary CTA */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Global Search */}
            <div ref={searchRef} className="relative hidden md:block w-60 lg:w-72">
              <Search className="w-3.5 h-3.5 text-[#717789] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Search students, invoices..."
                className="w-full rounded-[9px] bg-[#F7F8FC] border border-[#EAECF2] pl-8 pr-3 py-1.5 text-xs text-[#171923] placeholder:text-[#717789] focus:outline-none focus:bg-white focus:border-[#7257E8] transition-colors"
              />

              {searchFocused && q.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-white border border-[#EAECF2] shadow-[0_12px_32px_rgba(23,25,35,0.08)] p-2 z-50 max-h-80 overflow-y-auto">
                  {matchedStudents.length === 0 && matchedInvoices.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-[#717789]">
                      No matches for &ldquo;{searchQuery}&rdquo;
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matchedStudents.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#717789]">
                            Students
                          </div>
                          {matchedStudents.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSearchFocused(false);
                                setSearchQuery('');
                                onJumpToStudent(s.id);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-[#F7F8FC] text-left"
                            >
                              <span className="font-medium text-[#171923]">{s.fullName}</span>
                              <span className="text-[#717789]">{s.grade}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {matchedInvoices.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#717789]">
                            Invoices
                          </div>
                          {matchedInvoices.map((inv) => {
                            const stu = db.students.find((s) => s.id === inv.studentId);
                            return (
                              <button
                                key={inv.id}
                                type="button"
                                onClick={() => {
                                  setSearchFocused(false);
                                  setSearchQuery('');
                                  onJumpToInvoice(inv.id);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-[#F7F8FC] text-left"
                              >
                                <span className="font-medium text-[#171923]">
                                  {inv.invoiceNumber} · {stu?.fullName ?? 'Student'}
                                </span>
                                <span className="font-mono text-[#7257E8]">
                                  {formatINR(inv.totalAmount)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                className="relative p-2 rounded-[9px] text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] border border-transparent hover:border-[#EAECF2] transition-colors"
                aria-label="Action notifications"
              >
                <Bell className="w-4 h-4" />
                {actions.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E35454] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {actions.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-[#EAECF2] shadow-[0_16px_40px_rgba(23,25,35,0.1)] p-3 z-50">
                  <div className="flex items-center justify-between px-2 pb-2 border-b border-[#EAECF2]">
                    <span className="text-xs font-semibold text-[#171923]">
                      Priority Alerts ({actions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onSelectNav('action-center');
                      }}
                      className="text-[11px] font-medium text-[#7257E8] hover:underline"
                    >
                      Open Action Center
                    </button>
                  </div>
                  <div className="divide-y divide-[#EAECF2] max-h-72 overflow-y-auto">
                    {actions.slice(0, 5).map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onActionClick(act);
                        }}
                        className="w-full text-left px-2 py-2.5 hover:bg-[#F7F8FC] rounded-lg transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={`font-semibold ${
                              act.priority === 'Critical'
                                ? 'text-[#E35454]'
                                : act.priority === 'High'
                                  ? 'text-[#EAA23B]'
                                  : 'text-[#4779E8]'
                            }`}
                          >
                            {act.priority}
                          </span>
                          <span className="font-mono text-[#171923] font-medium">
                            {formatINR(act.amount)}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-[#171923] mt-0.5 line-clamp-1">
                          {act.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Help Button */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="p-2 rounded-[9px] text-[#717789] hover:text-[#171923] hover:bg-[#F7F8FC] border border-transparent hover:border-[#EAECF2] transition-colors"
              aria-label="TutorFlow AI Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Profile Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-[#F7F8FC] transition-colors"
                aria-label="User profile menu"
              >
                {renderAvatar('w-8 h-8')}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-[#EAECF2] shadow-[0_16px_40px_rgba(23,25,35,0.1)] p-2 z-50">
                  <div className="px-3 py-2.5 border-b border-[#EAECF2]">
                    <div className="text-xs font-semibold text-[#171923]">{user.name}</div>
                    <div className="text-[11px] text-[#717789]">{user.businessName}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-[#717789]">Cash on Hand</span>
                      <span className="font-mono font-semibold text-[#16A36A]">
                        {formatINR(user.openingCashBalance)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectNav('settings');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#171923] hover:bg-[#F7F8FC]"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#717789]" />
                      Studio &amp; Cash Settings
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileOpen(false);
                        await onResetDemo();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#717789] hover:text-[#E35454] hover:bg-[#F7F8FC]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Demo Dataset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={onNewInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors shadow-[0_2px_8px_rgba(114,87,232,0.25)] whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Invoice</span>
              <span className="sm:hidden">Invoice</span>
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-[#EAECF2] px-2 py-1.5 flex items-center justify-around no-print"
        aria-label="Mobile quick navigation"
      >
        {(
          [
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'invoices', label: 'Invoices', icon: FileText },
            { id: 'forecast', label: 'Cash', icon: TrendingUp },
            { id: 'copilot', label: 'Copilot', icon: Bot },
          ] as const
        ).map((m) => {
          const Icon = m.icon;
          const active = activeNav === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectNav(m.id)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${
                active ? 'text-[#7257E8]' : 'text-[#717789]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Help & Product Guide Modal */}
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="TutorFlow AI — Quick Guide"
        subtitle="Teach Better. Manage Smarter."
      >
        <div className="space-y-4 text-xs text-[#717789] leading-relaxed">
          <div className="p-3.5 rounded-xl bg-[#F0ECFF]/60 border border-[#7257E8]/15 text-[#171923]">
            <div className="font-semibold text-[#7257E8]">Your Entire Back Office in One Place</div>
            <p className="mt-1 text-[#717789]">
              TutorFlow AI is preloaded with sample demo data ({db.students.length} students, overdue &amp; partial invoices, and recurring bills) so you can explore every workflow right away.
            </p>
          </div>
          <div className="space-y-2.5">
            <div>
              <span className="font-semibold text-[#171923]">1. Track Who Owes Money:</span>{' '}
              Use Overview, Students, and Invoices to monitor paid, partial, pending, and overdue balances.
            </div>
            <div>
              <span className="font-semibold text-[#171923]">2. Follow Up Faster:</span>{' '}
              Open Payment Follow-ups inside Invoices (or click Remind on any row) to generate English/Hindi reminders via AI and launch WhatsApp drafts.
            </div>
            <div>
              <span className="font-semibold text-[#171923]">3. Forecast &amp; Stress-Test Cash:</span>{' '}
              Inspect 30/60/90-day projections in Cash Flow and test 15-day payment delays in What-if Simulator.
            </div>
            <div>
              <span className="font-semibold text-[#171923]">4. Ask TutorFlow Copilot:</span>{' '}
              Ask natural financial questions grounded strictly in your real INR ledger.
            </div>
          </div>
          <div className="pt-2 border-t border-[#EAECF2] flex justify-end">
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="px-4 py-2 rounded-[9px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6]"
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
