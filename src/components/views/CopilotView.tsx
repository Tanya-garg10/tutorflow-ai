import { useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { api } from '../../services/api.ts';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'gemini' | 'grounded-engine';
}

const SUGGESTED_QUESTIONS = [
  'Who owes me the most money?',
  'How much cash will I have next month?',
  'Which payments should I chase today?',
  'Can I afford a new monthly expense of ₹5,000?',
  'What happens if Rahul pays 15 days late?',
];

export function CopilotView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        'Hi Tanya! I am TutorFlow Copilot — your intelligent financial assistant. Ask me about overdue tuition fees, upcoming bills, your 30–90 day cash runway, or test a what-if delay using your real ledger.',
      source: 'grounded-engine',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askCopilot({
        question: trimmed,
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          source: res.source,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          content:
            'Unable to reach the server right now. Please verify the backend is running and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#171923]">
            TutorFlow Copilot
          </h1>
          <p className="text-sm text-[#717789] mt-0.5">
            Your intelligent financial assistant, grounded in live INR ledger data.
          </p>
        </div>
      </div>

      {/* Main Conversational Surface */}
      <div className="fintech-card flex flex-col h-[620px] overflow-hidden">
        {/* Top Suggested Question Chips */}
        <div className="px-5 py-3.5 border-b border-[#EAECF2] bg-[#F7F8FC]/60">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#717789] mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#7257E8]" />
            <span>Suggested Questions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendQuestion(q)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full bg-white border border-[#EAECF2] text-xs font-medium text-[#171923] hover:border-[#7257E8] hover:text-[#7257E8] transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-white">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#F0ECFF] border border-[#7257E8]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-[#7257E8]" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-[#7257E8] text-white'
                    : 'bg-[#F7F8FC] border border-[#EAECF2] text-[#171923]'
                }`}
              >
                {msg.content}
                {msg.role === 'assistant' && msg.source && (
                  <div className="text-[10px] text-[#717789] mt-2 pt-1.5 border-t border-[#EAECF2]">
                    {msg.source === 'gemini'
                      ? 'Answered via Gemini AI + Live Ledger'
                      : 'Answered via Grounded Financial Engine'}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-[#F7F8FC] border border-[#EAECF2] flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-[#717789]" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F0ECFF] border border-[#7257E8]/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#7257E8]" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-[#F7F8FC] border border-[#EAECF2] text-xs text-[#717789] flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7257E8] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7257E8] animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7257E8] animate-bounce [animation-delay:240ms]" />
                </span>
                <span>Checking invoices, expenses, and cash runway...</span>
              </div>
            </div>
          )}
        </div>

        {/* Rounded Composer */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-[#EAECF2] bg-[#F7F8FC]/60 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about pending fees, cash runway, or a 15-day delay..."
            className="flex-1 rounded-xl bg-white border border-[#EAECF2] px-4 py-2.5 text-sm text-[#171923] placeholder:text-[#717789] focus:outline-none focus:border-[#7257E8]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#7257E8] text-white hover:bg-[#6046D6] transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
