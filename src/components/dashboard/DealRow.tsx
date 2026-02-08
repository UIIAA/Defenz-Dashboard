"use client";

import { motion } from 'framer-motion';
import { Tooltip } from '@/components/ui/Tooltip';
import type { Deal } from '@/lib/types';
import { formatCurrency, originBadge, normalizeDate } from '@/lib/formatters';

const ACTIVITY_LABELS: Record<string, string> = {
  call: 'Ligacao',
  email: 'Email',
  meeting: 'Reuniao',
};

function formatDateBR(dateStr: string | undefined): string {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return '';
  const [y, m, d] = normalized.split('-');
  return `${d}/${m}/${y}`;
}

function buildTooltipContent(deal: Deal, type: 'active' | 'closed'): string | null {
  const lines: string[] = [];

  if (type === 'closed') {
    const closedDate = formatDateBR(deal.data);
    if (closedDate) lines.push(`Fechado em ${closedDate}`);
  } else if (deal.stage) {
    if (deal.days_in_stage != null) {
      lines.push(`${deal.stage} ha ${deal.days_in_stage} dia${deal.days_in_stage !== 1 ? 's' : ''}`);
    } else {
      lines.push(`Stage: ${deal.stage}`);
    }
  }

  const modDate = formatDateBR(deal.modified_time);
  if (modDate) lines.push(`Atualizado: ${modDate}`);

  if (deal.last_activity_type && deal.last_activity_type !== 'none' && deal.last_activity_date) {
    const label = ACTIVITY_LABELS[deal.last_activity_type] || deal.last_activity_type;
    const actDate = formatDateBR(deal.last_activity_date);
    if (actDate) lines.push(`Ultima atividade: ${label} em ${actDate}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

export const DealRow = ({ deal, type }: { deal: Deal; type: 'active' | 'closed' }) => {
  const badge = originBadge(deal.categoria);
  const tooltipText = buildTooltipContent(deal, type);

  const row = (
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

  if (!tooltipText) return row;

  return (
    <Tooltip content={<span className="whitespace-pre-line">{tooltipText}</span>}>
      {row}
    </Tooltip>
  );
};
