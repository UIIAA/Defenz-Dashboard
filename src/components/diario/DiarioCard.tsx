"use client";

import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { MagicCard } from '@/components/ui/MagicCard';

interface DiarioCardProps {
  icon: LucideIcon;
  title: string;
  /** Main value. When null → renders "—" (não capturado). */
  value: string | null;
  subtext?: string | null;
  /** Highlight key metrics in red (Defenz Lux primary). */
  highlight?: boolean;
  loading?: boolean;
  /** Small badge next to the value, e.g. "~" for aproximado. */
  badge?: string;
  badgeTitle?: string;
}

export const DiarioCard = ({
  icon: Icon,
  title,
  value,
  subtext,
  highlight,
  loading,
  badge,
  badgeTitle,
}: DiarioCardProps) => {
  const muted = value === null;
  return (
    <MagicCard className="h-full flex flex-col justify-between border-slate-200/60 bg-white/60 hover:border-red-500/30 hover:shadow-red-500/5 transition-all duration-500 min-h-[150px]">
      <div className="flex justify-between items-start mb-4">
        <div className="text-slate-500 font-bold uppercase tracking-widest font-display text-xs">{title}</div>
        <div className={`rounded-lg p-2 ${highlight ? 'bg-red-500/10 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
          <Icon size={18} strokeWidth={2} />
        </div>
      </div>

      {loading ? (
        <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
      ) : (
        <motion.div
          initial={{ scale: 0.95, opacity: 0, filter: 'blur(4px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-baseline gap-2"
        >
          <span className={`text-3xl lg:text-4xl font-semibold tracking-tight font-display ${muted ? 'text-slate-300' : highlight ? 'text-red-600' : 'text-slate-900'}`}>
            {muted ? '—' : value}
          </span>
          {badge && !muted && (
            <span title={badgeTitle} className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded cursor-help">
              {badge}
            </span>
          )}
        </motion.div>
      )}

      <div className="border-t border-slate-100 pt-3 mt-auto">
        <p className={`text-sm font-medium ${muted ? 'text-slate-400 italic' : 'text-slate-500'}`}>
          {loading ? '' : muted ? 'não capturado' : subtext ?? ''}
        </p>
      </div>
    </MagicCard>
  );
};
