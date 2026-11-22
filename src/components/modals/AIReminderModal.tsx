import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  History,
  Languages,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import type {
  FollowUpStatus,
  Invoice,
  Reminder,
  ReminderLanguage,
  ReminderTone,
  Student,
} from '../../types/finance.ts';
import {
  buildTemplateReminder,
  formatFullDate,
  formatINR,
  getInvoiceRemaining,
  getOverdueDays,
  getTodayISO,
} from '../../services/financeEngine.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../ui/Modal.tsx';

interface AIReminderModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  student: Student | null;
  upiId: string;
  reminders: Reminder[];
  onSavedReminder: (reminder: Reminder) => void;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const TONE_OPTIONS: Array<{ id: ReminderTone; label: string }> = [
  { id: 'polite', label: 'Polite' },
  { id: 'friendly_whatsapp', label: 'Friendly' },
  { id: 'professional', label: 'Professional' },
  { id: 'firm', label: 'Firm' },
];

export function AIReminderModal({
  open,
  onClose,
  invoice,
  student,
  upiId,
  reminders,
  onSavedReminder,
  onToast,
}: AIReminderModalProps) {
  const [tone, setTone] = useState<ReminderTone>('polite');
  const [language, setLanguage] = useState<ReminderLanguage>('English');
  const [message, setMessage] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>('Drafted');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<'gemini' | 'template' | null>(null);
  const [copied, setCopied] = useState(false);

  const invoiceReminders = invoice
    ? reminders.filter((r) => r.invoiceId === invoice.id)
    : [];

  useEffect(() => {
    if (!open || !invoice || !student) return;
    const todayStr = getTodayISO();
    const remaining = getInvoiceRemaining(invoice);
    const overdueDays = getOverdueDays(invoice.dueDate, todayStr);
    const defaultMsg = buildTemplateReminder({
      studentName: student.fullName,
      amount: remaining,
      overdueDays,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
      upiId,
      tone,
      language,
      isPartial: invoice.paidAmount > 0 && remaining > 0,
    });
    setMessage(defaultMsg);
    setSourceLabel('template');
    setCopied(false);
    setFollowUpStatus('Drafted');
    setNote('');
  }, [open, invoice?.id, student?.id, tone, language, upiId]);

  if (!invoice || !student) return null;

  const remaining = getInvoiceRemaining(invoice);
  const overdueDays = getOverdueDays(invoice.dueDate, getTodayISO());
  const sanitizedDigits = student.phone.replace(/\D/g, '');
  const whatsappNumber =
    sanitizedDigits.length === 10 ? `91${sanitizedDigits}` : sanitizedDigits;
  const hasPhone = whatsappNumber.length >= 10;

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const res = await api.generateAIReminder({
        invoiceId: invoice.id,
        tone,
        language,
      });
      setMessage(res.message);
      setSourceLabel(res.source);
      onToast(
        'info',
        res.source === 'gemini'
          ? 'Personalized reminder generated with AI.'
          : 'Generated using smart template.'
      );
    } catch {
      onToast('error', 'Could not reach AI service; template message remains ready.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveLog = async (
    statusOverride?: FollowUpStatus,
    channel: Reminder['channel'] = 'WhatsApp'
  ) => {
    try {
      const saved = await api.saveReminder({
        invoiceId: invoice.id,
        channel,
        tone,
        language,
        message,
        followUpStatus: statusOverride ?? followUpStatus,
        note: note.trim() || undefined,
      });
      onSavedReminder(saved);
      if (!statusOverride) {
        onToast('success', 'Follow-up saved to reminder history.');
      }
    } catch {
      onToast('error', 'Failed to save reminder history.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setFollowUpStatus('Copied');
      await handleSaveLog('Copied', 'WhatsApp');
      onToast('success', 'Message copied and logged.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('error', 'Clipboard copy failed.');
    }
  };

  const whatsappHref = hasPhone
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : '#';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment Follow-up Assistant"
      subtitle={`${student.fullName} · ${invoice.invoiceNumber} · Balance ${formatINR(remaining)}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Context bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs">
          <div>
            <div className="text-[#717789]">Outstanding</div>
            <div className="text-sm font-semibold text-[#171923] font-mono tabular-nums mt-0.5">
              {formatINR(remaining)}
            </div>
          </div>
          <div>
            <div className="text-[#717789]">Due Date</div>
            <div className="text-sm font-medium text-[#171923] mt-0.5">
              {formatFullDate(invoice.dueDate)}
            </div>
          </div>
          <div>
            <div className="text-[#717789]">Status</div>
            <div
              className={`text-sm font-medium mt-0.5 ${
                overdueDays > 0 ? 'text-[#E35454]' : 'text-[#4779E8]'
              }`}
            >
              {overdueDays > 0 ? `${overdueDays}d overdue` : 'Upcoming'}
            </div>
          </div>
          <div>
            <div className="text-[#717789]">Prior Follow-ups</div>
            <div className="text-sm font-medium text-[#171923] font-mono tabular-nums mt-0.5">
              {invoiceReminders.length}
            </div>
          </div>
        </div>

        {/* Tone + Language */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1.5">Tone</label>
            <div className="flex flex-wrap gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTone(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    tone === opt.id
                      ? 'bg-white text-[#7257E8] shadow-xs border border-[#EAECF2]'
                      : 'text-[#717789] hover:text-[#171923]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1.5">Language</label>
            <div className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-[#F7F8FC] border border-[#EAECF2]">
              {(['English', 'Hindi'] as ReminderLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    language === lang
                      ? 'bg-[#F0ECFF] text-[#7257E8]'
                      : 'text-[#717789] hover:text-[#171923]'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat-like Composer */}
        <div className="rounded-xl border border-[#EAECF2] bg-[#F7F8FC]/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#171923]">
              <span className="w-6 h-6 rounded-full bg-[#F0ECFF] text-[#7257E8] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span>AI Reminder Composer</span>
              {sourceLabel && (
                <span className="text-[#717789] font-normal">
                  · {sourceLabel === 'gemini' ? 'Gemini AI' : 'Smart template'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-semibold bg-[#F0ECFF] text-[#7257E8] hover:bg-[#7257E8] hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {generating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {generating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3.5 py-2.5 text-sm text-[#171923] leading-relaxed focus:outline-none focus:border-[#7257E8]"
          />
        </div>

        {/* Follow-up Status + Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Follow-up Status
            </label>
            <select
              value={followUpStatus}
              onChange={(e) => setFollowUpStatus(e.target.value as FollowUpStatus)}
              className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] focus:outline-none focus:border-[#7257E8]"
            >
              <option value="Drafted">Drafted</option>
              <option value="Copied">Copied</option>
              <option value="Opened in WhatsApp">Opened in WhatsApp</option>
              <option value="Follow-up Scheduled">Follow-up Scheduled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#717789] mb-1">
              Follow-up Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Parent promised transfer by Friday"
              className="w-full rounded-[9px] bg-white border border-[#EAECF2] px-3 py-2 text-sm text-[#171923] placeholder:text-[#717789] focus:outline-none focus:border-[#7257E8]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-medium bg-white text-[#171923] border border-[#EAECF2] hover:bg-[#F7F8FC] transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#16A36A]" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#7257E8]" />
              )}
              {copied ? 'Copied' : 'Copy Message'}
            </button>

            {hasPhone && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setFollowUpStatus('Opened in WhatsApp');
                  void handleSaveLog('Opened in WhatsApp', 'WhatsApp');
                  onToast('info', 'Opened WhatsApp compose link with message pre-filled.');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-[#16A36A]/10 text-[#16A36A] hover:bg-[#16A36A]/15 transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Open WhatsApp ({student.phone})
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSaveLog()}
            className="px-4 py-2 rounded-[10px] text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors whitespace-nowrap shrink-0"
          >
            Save Log
          </button>
        </div>

        {invoiceReminders.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#EAECF2]">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#717789]">
              <History className="w-3.5 h-3.5" />
              <span>Reminder History ({invoiceReminders.length})</span>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {invoiceReminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-3 rounded-xl bg-[#F7F8FC] border border-[#EAECF2] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[#717789]">
                    <span>
                      {rem.createdAt.slice(0, 10)} · {rem.language} · {rem.tone.replace('_', ' ')}
                    </span>
                    <span className="text-[#7257E8] font-medium">{rem.followUpStatus}</span>
                  </div>
                  <p className="text-[#171923] leading-relaxed">{rem.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
