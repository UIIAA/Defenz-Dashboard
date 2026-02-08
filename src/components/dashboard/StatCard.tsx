"use client";

import { TrendingUp } from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
  loading?: boolean;
  trend?: 'up' | 'down';
}

export const StatCard = ({ icon: Icon, title, value, subtext, highlight, loading, trend }: StatCardProps) => (
  <MagicCard className="h-full flex flex-col justify-between border-slate-200/60 bg-white/60 hover:border-red-500/30 hover:shadow-red-500/5 transition-all duration-500">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest font-display">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 rounded mt-1 animate-pulse"></div>
        ) : (
          <motion.h3
            initial={{ scale: 0.95, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`text-2xl lg:text-3xl font-semibold mt-2 tracking-tight font-display ${highlight ? 'text-red-600' : 'text-slate-900'}`}
          >
            {value}
          </motion.h3>
        )}
      </div>
      <div className={`p-2 rounded-lg ${highlight ? 'bg-red-500/10 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon size={18} strokeWidth={2} />
      </div>
    </div>
    {subtext && (
      <div className="border-t border-slate-100 pt-3 mt-auto">
        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
          {trend === 'up' && <TrendingUp size={14} className="text-emerald-500" />}
          {trend === 'down' && <TrendingUp size={14} className="text-red-500 rotate-180" />}
          {subtext}
        </p>
      </div>
    )}
  </MagicCard>
);
