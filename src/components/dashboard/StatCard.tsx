"use client";

import { TrendingUp, Info } from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { HealthStatus } from '@/components/dashboard/DataHealthPanel';

const HEALTH_DOT: Record<HealthStatus, string> = {
  ok: 'bg-green-500',
  partial: 'bg-yellow-400',
  empty: 'bg-red-500',
};

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
  loading?: boolean;
  trend?: 'up' | 'down';
  tooltip?: ReactNode;
  heroSize?: boolean;
  comparisonLine?: string;
  healthStatus?: HealthStatus;
}

export const StatCard = ({ icon: Icon, title, value, subtext, highlight, loading, trend, tooltip, heroSize, comparisonLine, healthStatus }: StatCardProps) => (
  <MagicCard className="h-full flex flex-col justify-between border-slate-200/60 bg-white/60 hover:border-red-500/30 hover:shadow-red-500/5 transition-all duration-500">
    <div className={`flex justify-between items-start ${heroSize ? 'mb-5' : 'mb-4'}`}>
      <div>
        <div className={`text-slate-500 font-bold uppercase tracking-widest font-display flex items-center gap-1.5 ${heroSize ? 'text-sm' : 'text-xs'}`}>
          {healthStatus && (
            <span
              className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${HEALTH_DOT[healthStatus]}`}
              title={healthStatus === 'ok' ? 'Dados completos' : healthStatus === 'partial' ? 'Dados parciais' : 'Sem dados no período'}
            />
          )}
          {title}
          {tooltip && (
            <Tooltip content={tooltip}>
              <Info size={heroSize ? 14 : 12} className="text-slate-300 hover:text-slate-500 transition-colors cursor-help" />
            </Tooltip>
          )}
        </div>
        {loading ? (
          <div className={`bg-slate-200 rounded mt-1 animate-pulse ${heroSize ? 'h-10 w-32' : 'h-8 w-24'}`}></div>
        ) : (
          <motion.h3
            initial={{ scale: 0.95, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`font-semibold mt-2 tracking-tight font-display ${
              heroSize ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'
            } ${highlight ? 'text-red-600' : 'text-slate-900'}`}
          >
            {value}
          </motion.h3>
        )}
      </div>
      <div className={`rounded-lg ${highlight ? 'bg-red-500/10 text-red-600' : 'bg-slate-100 text-slate-400'} ${heroSize ? 'p-3' : 'p-2'}`}>
        <Icon size={heroSize ? 24 : 18} strokeWidth={2} />
      </div>
    </div>
    {(subtext || comparisonLine) && (
      <div className="border-t border-slate-100 pt-3 mt-auto">
        {subtext && (
          <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
            {trend === 'up' && <TrendingUp size={14} className="text-emerald-500" />}
            {trend === 'down' && <TrendingUp size={14} className="text-red-500 rotate-180" />}
            {subtext}
          </p>
        )}
        {comparisonLine && (
          <p className="text-xs text-slate-400 mt-1">{comparisonLine}</p>
        )}
      </div>
    )}
  </MagicCard>
);
