import { DocStatus } from '@/types';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

const config: Record<DocStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  uploaded: {
    label: 'Uploaded',
    icon: <Clock className="w-3 h-3" />,
    cls: 'bg-slate-100 text-slate-600',
  },
  processing: {
    label: 'Processing',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    cls: 'bg-blue-100 text-blue-700',
  },
  ready: {
    label: 'Ready',
    icon: <CheckCircle2 className="w-3 h-3" />,
    cls: 'bg-green-100 text-green-700',
  },
  failed: {
    label: 'Failed',
    icon: <AlertCircle className="w-3 h-3" />,
    cls: 'bg-red-100 text-red-700',
  },
};

export default function DocumentStatusBadge({ status }: { status: DocStatus }) {
  const { label, icon, cls } = config[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {icon}
      {label}
    </span>
  );
}
