"use client";

import { motion } from 'framer-motion';
import type { Deal } from '@/lib/types';
import { formatCurrency, originBadge } from '@/lib/formatters';

export const DealRow = ({ deal, type }: { deal: Deal; type: 'active' | 'closed' }) => {
  const badge = originBadge(deal.categoria);
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all text-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${type === 'active' ? 'bg-amber-400' : 'bg-emerald-500'} shadow-sm`} />
        <div>
          <p className="text-slate-700 font-semibold font-display text-sm leading-tight">{deal.nome}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {badge && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                {badge.label}
              </span>
            )}
            <p className="text-xs text-slate-400 uppercase tracking-wider">{deal.empresa || deal.origem}</p>
          </div>
        </div>
      </div>
      <div className="text-right">
        {deal.comissao_valor && deal.comissao_valor > 0 ? (
          <>
            <p className="text-red-600 font-mono font-bold text-sm">{formatCurrency(deal.comissao_valor)}</p>
            <p className="text-[10px] text-slate-400 font-mono">{deal.valor ? formatCurrency(deal.valor) : '-'}</p>
          </>
        ) : (
          <>
            <p className="text-slate-900 font-mono font-medium text-sm">{deal.valor ? formatCurrency(deal.valor) : '-'}</p>
            <p className="text-xs text-slate-400">{deal.data}</p>
          </>
        )}
      </div>
    </motion.div>
  );
};
