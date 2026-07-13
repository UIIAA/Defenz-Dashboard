"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  Target, RefreshCcw, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WeekMetric, MetasResponse, FarolCor } from '@/lib/types';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const nf = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number) => `${Math.round(n * 100)}%`;

const COR: Record<FarolCor, { dot: string; bar: string; text: string; ring: string; bg: string }> = {
  verde: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500/20', bg: 'bg-emerald-50' },
  amarelo: { dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-500/20', bg: 'bg-amber-50' },
  vermelho: { dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500/20', bg: 'bg-red-50' },
};

const ESFORCO_ITEMS: { key: keyof WeekMetric['esforco']; label: string }[] = [
  { key: 'ligacoes', label: 'Ligações' },
  { key: 'emails', label: 'Emails' },
  { key: 'apresentacoes', label: 'Apresentações' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'reunioes', label: 'Reuniões' },
];

function weekLabel(w: WeekMetric): string {
  const s = format(new Date(`${w.weekStart}T12:00:00`), 'dd/MM', { locale: ptBR });
  const e = format(new Date(`${w.weekEnd}T12:00:00`), 'dd/MM', { locale: ptBR });
  return `${s}–${e}`;
}

function DeltaBadge({ v, label }: { v: number | null; label?: string }) {
  if (v === null) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">{label ? `${label} —` : '—'}</span>;
  }
  const flat = v === 0;
  const up = v > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat ? 'text-slate-400' : up ? 'text-emerald-600' : 'text-red-500';
  const txt = `${up && !flat ? '+' : ''}${Math.round(v * 100)}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cls}`}>
      <Icon size={12} strokeWidth={2.5} />
      {label ? `${label} ${txt}` : txt}
    </span>
  );
}

function WeekHeaderCard({ w }: { w: WeekMetric }) {
  const c = COR[w.cor];
  const fill = Math.min(Math.max(w.pctAbs, 0), 1) * 100;
  return (
    <div className={`rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5 ring-1 ${c.ring}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Semana Atual</h2>
          <p className="text-xs text-slate-400 mt-0.5">{weekLabel(w)}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
          <span className={`h-2 w-2 rounded-full ${c.dot}`} />
          {w.label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900 font-display tabular-nums">
          {brl(w.revenue)}
        </span>
        <span className="text-sm text-slate-400 tabular-nums">/ {brl(w.goal)} meta</span>
      </div>

      <div className="relative mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-y-0 left-0 rounded-full ${c.bar}`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={`font-bold tabular-nums ${c.text}`}>{pct(w.pctAbs)} da meta</span>
        <span className="text-slate-400">semana em andamento</span>
      </div>
    </div>
  );
}

function PorqueBloco({ w, isRetro }: { w: WeekMetric; isRetro: boolean }) {
  const c = COR[w.cor];
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Por que bati / não bati</h2>
        <span className="text-xs text-slate-400">{isRetro ? `semana ${weekLabel(w)} (fechada)` : weekLabel(w)}</span>
      </div>
      <p className={`text-sm font-medium mb-4 ${c.text}`}>{w.diagnostico}</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ESFORCO_ITEMS.map(it => (
          <div key={it.key} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{it.label}</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">{nf(w.esforco[it.key])}</p>
            <DeltaBadge v={w.delta[it.key]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparativoChart({ semanas }: { semanas: WeekMetric[] }) {
  const data = [...semanas].reverse().map(w => ({
    label: weekLabel(w),
    receita: w.revenue,
    meta: w.goal,
    esforcoTotal:
      w.esforco.ligacoes + w.esforco.emails + w.esforco.apresentacoes + w.esforco.propostas + w.esforco.reunioes,
  }));

  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">
        Comparativo — últimas {semanas.length} semanas
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis yAxisId="rev" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="esf" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <ReTooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any, name: any) => {
              const v = Number(value) || 0;
              return name === 'Esforço total' ? [nf(v), name] : [brl(v), name];
            }) as never}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Bar yAxisId="rev" dataKey="receita" name="Receita" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line yAxisId="rev" type="monotone" dataKey="meta" name="Meta (R$6k)" stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Line yAxisId="esf" type="monotone" dataKey="esforcoTotal" name="Esforço total" stroke="#0ea5e9" strokeWidth={1.5} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export const MetasDashboard = () => {
  const [response, setResponse] = useState<MetasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/metas');
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const json = (await res.json()) as MetasResponse;
      setResponse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const semanas = response?.semanas ?? [];
  const atual = semanas[0];
  // "Bati/não bati" é retrospectivo → analisa a última semana FECHADA (comparação
  // justa full-vs-full). O header mostra a semana atual ao vivo (pace). semanas[0]
  // sempre contém hoje (em andamento), então a última fechada é semanas[1].
  const retro = semanas.length > 1 ? semanas[1] : atual;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 font-display">Farol de Metas</h1>
          <p className="text-red-600 text-sm font-bold tracking-wide mt-1">META SEMANAL R$ 6.000 · POR QUE BATI / NÃO BATI</p>
        </div>
        <div className="flex items-center gap-3">
          {response?._cached && <span className="text-xs text-amber-500">cache</span>}
          <button
            onClick={fetchData}
            disabled={loading}
            title="Atualizar"
            className="p-2 rounded-full bg-white/80 border border-slate-200/60 text-slate-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle size={36} className="text-red-500 mb-3" />
          <p className="text-slate-600">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
            Tentar novamente
          </button>
        </div>
      ) : loading && !response ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 size={36} className="animate-spin text-red-500 mb-4" />
          <p className="text-slate-400 text-sm">Carregando metas...</p>
        </div>
      ) : !atual ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Target size={32} className="text-slate-300 mb-3" />
          <p className="text-lg text-slate-600">Sem dados suficientes para calcular as metas</p>
          <p className="text-sm text-slate-400 mt-2">Verifique se as abas `resumo_diario` e `deals` estão populadas.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
            <WeekHeaderCard w={atual} />
            <PorqueBloco w={retro} isRetro={semanas.length > 1} />
          </div>
          {semanas.length > 1 && <ComparativoChart semanas={semanas} />}
        </motion.div>
      )}
    </div>
  );
};
