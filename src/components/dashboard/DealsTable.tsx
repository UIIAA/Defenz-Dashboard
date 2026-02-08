"use client";

import { Activity, CheckCircle2 } from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';
import { DealRow } from './DealRow';
import type { Deal } from '@/lib/types';

interface DealsTableProps {
  deals: Deal[];
  type: 'active' | 'closed';
  loading?: boolean;
}

export const DealsTable = ({ deals, type, loading }: DealsTableProps) => {
  const isActive = type === 'active';
  return (
    <MagicCard className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest font-display flex items-center gap-2">
          {isActive ? (
            <><Activity size={16} className="text-amber-500" /> Deals Ativos</>
          ) : (
            <><CheckCircle2 size={16} className="text-emerald-500" /> Clientes Fechados</>
          )}
        </h3>
        <span className="text-xs text-slate-400">{deals.length} registros</span>
      </div>
      <div className="p-3 overflow-y-auto max-h-[420px] space-y-1">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-800/20 rounded-lg animate-pulse mb-2" />)
        ) : (
          deals.map((deal, idx) => (
            <DealRow key={`${type}-${deal.id}-${idx}`} deal={deal} type={type} />
          ))
        )}
      </div>
    </MagicCard>
  );
};
