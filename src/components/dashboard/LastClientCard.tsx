"use client";

import { Target } from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';
import { formatCurrency } from '@/lib/formatters';
import type { Client } from '@/lib/types';

interface LastClientCardProps {
  client: Client | undefined;
  loading?: boolean;
}

export const LastClientCard = ({ client, loading }: LastClientCardProps) => (
  <MagicCard className="p-6 bg-gradient-to-br from-red-50 to-transparent">
    <h3 className="text-xs font-bold text-red-600 mb-2 uppercase tracking-widest font-display flex items-center gap-2">
      <Target size={14} /> Último Fechamento
    </h3>
    {loading ? (
      <div className="h-12 bg-slate-100 rounded w-full animate-pulse" />
    ) : (
      <div>
        <p className="text-2xl font-display font-medium text-slate-900 leading-snug">{client?.nome}</p>
        <div className="mt-4 flex justify-between items-end border-t border-red-100 pt-4">
          <div>
            <p className="text-xs text-slate-500 uppercase mb-0.5">Origem</p>
            <p className="text-sm text-slate-700 font-medium">{client?.origem}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase mb-0.5">Valor</p>
            <p className="text-red-600 text-lg font-mono font-bold">{formatCurrency(client?.valor || 0)}</p>
          </div>
        </div>
      </div>
    )}
  </MagicCard>
);
