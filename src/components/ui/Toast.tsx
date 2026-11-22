import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon =
          t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
        const iconColor =
          t.type === 'success'
            ? 'text-[#16A36A]'
            : t.type === 'error'
              ? 'text-[#E35454]'
              : 'text-[#7257E8]';

        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-[#EAECF2] shadow-[0_10px_30px_rgba(23,25,35,0.08)] text-sm text-[#171923]"
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
            <p className="flex-1 leading-snug text-[13px] font-medium">{t.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-[#717789] hover:text-[#171923] transition-colors p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
