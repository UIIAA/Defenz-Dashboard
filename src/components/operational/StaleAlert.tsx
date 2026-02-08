"use client";

import { AlertTriangle } from 'lucide-react';

interface StaleAlertProps {
  lastDate: string;
}

export const StaleAlert = ({ lastDate }: StaleAlertProps) => {
  const days = lastDate
    ? Math.round((new Date().getTime() - new Date(lastDate).getTime()) / 86400000)
    : null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
      <AlertTriangle size={10} />
      {days !== null ? `${days}d sem atividade` : 'Sem atividade'}
    </span>
  );
};
