"use client";

import { MagicCard } from '@/components/ui/MagicCard';
import type { Partners } from '@/lib/types';

interface PartnersCardProps {
  partners: Partners | undefined;
  loading?: boolean;
}

export const PartnersCard = ({ partners, loading }: PartnersCardProps) => (
  <MagicCard className="p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest font-display">Parceiros Ativos</h3>
      <span className="bg-blue-50 text-blue-600 text-xs font-mono px-2 py-1 rounded border border-blue-100">{partners?.total || 0} TOTAL</span>
    </div>
    {loading ? (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-6 bg-slate-200 rounded w-full animate-pulse" />)}
      </div>
    ) : (
      <div className="flex flex-wrap gap-2">
        {partners?.lista.map((partner, i) => (
          <span key={i} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors cursor-default">
            {partner}
          </span>
        ))}
      </div>
    )}
  </MagicCard>
);
