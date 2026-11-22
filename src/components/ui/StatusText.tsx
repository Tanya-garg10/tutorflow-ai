import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  PieChart,
} from 'lucide-react';
import type { InvoiceStatus } from '../../types/finance.ts';

interface StatusTextProps {
  status:
    | InvoiceStatus
    | 'Upcoming'
    | 'Healthy'
    | 'Tight'
    | 'At Risk'
    | 'paid'
    | 'pending'
    | 'overdue'
    | 'partial';
  extraLabel?: string;
}

export function StatusText({ status, extraLabel }: StatusTextProps) {
  const s = status.toLowerCase();

  if (s === 'paid' || s === 'healthy') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#16A36A]/10 text-[#16A36A] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{status === 'paid' ? 'Paid' : status}</span>
        {extraLabel && <span className="opacity-80">· {extraLabel}</span>}
      </span>
    );
  }

  if (s === 'overdue' || s === 'at risk') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E35454]/10 text-[#E35454] whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{status === 'overdue' ? 'Overdue' : status}</span>
        {extraLabel && <span className="opacity-85">· {extraLabel}</span>}
      </span>
    );
  }

  if (s === 'partially paid' || s === 'partial' || s === 'tight') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAA23B]/12 text-[#B87314] whitespace-nowrap">
        <PieChart className="w-3.5 h-3.5 shrink-0 text-[#EAA23B]" />
        <span>{status === 'partial' ? 'Partial' : status}</span>
        {extraLabel && <span className="opacity-80">· {extraLabel}</span>}
      </span>
    );
  }

  if (s === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F7F8FC] border border-[#EAECF2] text-[#717789] whitespace-nowrap">
        <FileEdit className="w-3.5 h-3.5 shrink-0" />
        <span>Draft</span>
        {extraLabel && <span>· {extraLabel}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#4779E8]/10 text-[#4779E8] whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{status === 'pending' ? 'Pending' : status}</span>
      {extraLabel && <span className="opacity-80">· {extraLabel}</span>}
    </span>
  );
}
