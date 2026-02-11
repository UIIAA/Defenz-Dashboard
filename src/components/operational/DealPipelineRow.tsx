"use client";

import { useState } from 'react';
import { ChevronDown, Phone, Mail, Calendar, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OperationalDeal } from '@/lib/types';
import { formatCurrency, originBadge } from '@/lib/formatters';
import { DealAgingBadge } from './DealAgingBadge';
import { StaleAlert } from './StaleAlert';
import { ActivityTimeline } from './ActivityTimeline';

const activityIcon: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
};

interface DealPipelineRowProps {
  deal: OperationalDeal;
  index: number;
  compact?: boolean;
}

export const DealPipelineRow = ({ deal, index, compact }: DealPipelineRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const badge = originBadge(deal.categoria);
  const LastIcon = activityIcon[deal.last_activity_type] || AlertCircle;

  const lastActivityLabel = deal.last_activity_date
    ? (() => {
        const days = Math.round(
          (Date.now() - new Date(deal.last_activity_date).getTime()) / 86400000
        );
        const tipo = deal.last_activity_type === 'none' ? '' : deal.last_activity_type;
        if (days === 0) return `${tipo} hoje`.trim();
        if (days === 1) return `${tipo} ontem`.trim();
        return `${tipo} ${days}d atras`.trim();
      })()
    : 'sem atividade';

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/60"
      >
        <DealAgingBadge days={deal.days_in_stage} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">{deal.nome}</span>
            {badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            <span>{deal.stage}</span>
            <span>·</span>
            <span>{formatCurrency(deal.comissao_valor || 0)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LastIcon size={12} className="text-slate-400" />
          <span className="text-[11px] text-slate-400 capitalize">{lastActivityLabel}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border border-slate-100 rounded-lg bg-white hover:shadow-sm transition-shadow"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer"
      >
        {/* Aging badge */}
        <DealAgingBadge days={deal.days_in_stage} />

        {/* Deal info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">
              {deal.nome}
            </span>
            {badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                {badge.label}
              </span>
            )}
            {deal.is_stale && <StaleAlert lastDate={deal.last_activity_date} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            <span>{deal.stage}</span>
            <span>·</span>
            <span>{deal.empresa !== '-' ? deal.empresa : deal.origem}</span>
          </div>
        </div>

        {/* Value */}
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-slate-800">
            {formatCurrency(deal.comissao_valor || 0)}
          </div>
          <div className="text-[10px] text-slate-400">
            {formatCurrency(deal.valor || 0)}
          </div>
        </div>

        {/* Last activity indicator */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-[100px] justify-end">
          <LastIcon size={12} className="text-slate-400" />
          <span className="text-[11px] text-slate-400 capitalize">{lastActivityLabel}</span>
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-300 shrink-0"
        >
          <ChevronDown size={16} />
        </motion.div>
      </button>

      {/* Expanded timeline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-50"
          >
            <div className="px-4 py-2">
              <ActivityTimeline activities={deal.activities} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
