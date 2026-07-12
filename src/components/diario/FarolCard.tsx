"use client";

import { Target, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Farol, FarolBucket, FarolCor } from '@/lib/types';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const COR: Record<FarolCor, { dot: string; bar: string; text: string; ring: string }> = {
  verde: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500/20' },
  amarelo: { dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-500/20' },
  vermelho: { dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500/20' },
};

function Bucket({
  icon: Icon,
  title,
  b,
}: {
  icon: typeof Target;
  title: string;
  b: FarolBucket;
}) {
  const c = COR[b.cor];
  const pct = Math.round(b.pctAbs * 100);
  const fill = Math.min(Math.max(b.pctAbs, 0), 1) * 100;
  const expectedPct = b.goal > 0 ? Math.min(Math.max(b.expected / b.goal, 0), 1) * 100 : 0;

  return (
    <div className={`flex-1 rounded-xl bg-white/60 border border-slate-200/60 p-4 ring-1 ${c.ring}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-slate-500">
          <Icon size={16} strokeWidth={2} />
          <span className="text-xs font-bold uppercase tracking-widest font-display">{title}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.text}`}>
          <span className={`h-2 w-2 rounded-full ${c.dot}`} />
          {b.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 font-display tabular-nums">
          {brl(b.revenue)}
        </span>
        <span className="text-sm text-slate-400 tabular-nums">/ {brl(b.goal)}</span>
      </div>

      {/* barra: preenchimento = % da meta · marcador = esperado pelo ritmo */}
      <div className="relative mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-y-0 left-0 rounded-full ${c.bar}`}
        />
      </div>
      <div className="relative h-0">
        {expectedPct > 0 && expectedPct < 100 && (
          <div
            className="absolute -top-2 h-2 w-0.5 bg-slate-400"
            style={{ left: `${expectedPct}%` }}
            title={`Esperado pelo ritmo: ${brl(b.expected)}`}
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={`font-bold tabular-nums ${c.text}`}>{pct}% da meta</span>
        <span className="text-slate-400 tabular-nums">esperado {brl(b.expected)}</span>
      </div>
    </div>
  );
}

export function FarolCard({ farol }: { farol: Farol }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Farol de Metas</h2>
        <span className="text-[11px] text-slate-400">meta R$ 6.000/semana · ao vivo</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Bucket icon={Target} title="Semana" b={farol.semana} />
        <Bucket icon={CalendarDays} title="Mês" b={farol.mes} />
      </div>
    </div>
  );
}
