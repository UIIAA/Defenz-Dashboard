"use client";

import { Mail, Phone, Calendar, Presentation, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { MagicCard } from '@/components/ui/MagicCard';
import type { ActivityMetrics } from '@/hooks/useActivityMetrics';
import type { LucideIcon } from 'lucide-react';

interface ActivityMetricsRowProps {
  metrics: ActivityMetrics | null;
  loading: boolean;
}

interface ActivityCardConfig {
  icon: LucideIcon;
  label: string;
  getValue: (m: ActivityMetrics) => number;
  getSubtext: (m: ActivityMetrics) => string;
}

const CARDS: ActivityCardConfig[] = [
  {
    icon: Mail,
    label: 'Emails Enviados',
    getValue: (m) => m.emails,
    getSubtext: () => 'via Apollo',
  },
  {
    icon: Phone,
    label: 'Ligacoes',
    getValue: (m) => m.ligacoes,
    getSubtext: (m) => `${m.ligacoes_atendidas} atendidas · ${m.taxa_conectividade}%`,
  },
  {
    icon: Calendar,
    label: 'Reunioes',
    getValue: (m) => m.reunioes,
    getSubtext: () => 'com <> no assunto',
  },
  {
    icon: Presentation,
    label: 'Apresentacoes',
    getValue: (m) => m.apresentacoes,
    getSubtext: () => '[APRESENTACAO]',
  },
  {
    icon: FileText,
    label: 'Propostas',
    getValue: (m) => m.propostas,
    getSubtext: () => 'Proposta Enviada',
  },
];

export const ActivityMetricsRow = ({ metrics, loading }: ActivityMetricsRowProps) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
    {CARDS.map((card, idx) => (
      <MagicCard
        key={card.label}
        className="border-slate-200/60 bg-white/60 hover:border-red-500/30 hover:shadow-red-500/5 transition-all duration-500"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-md bg-slate-100 text-slate-400">
            <card.icon size={14} strokeWidth={2} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-display truncate">
            {card.label}
          </p>
        </div>

        {loading || !metrics ? (
          <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
        ) : (
          <motion.p
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl font-semibold text-slate-900 tracking-tight font-display"
          >
            {card.getValue(metrics)}
          </motion.p>
        )}

        {metrics && !loading && (
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            {card.getSubtext(metrics)}
          </p>
        )}
      </MagicCard>
    ))}
  </div>
);
