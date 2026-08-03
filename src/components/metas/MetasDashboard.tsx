"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Target, CalendarDays, RefreshCcw, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Legend, Cell, LabelList,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WeekMetric, MetasResponse, MetasConsolidado, FarolBucket, FarolCor, MetasEficiencia } from '@/lib/types';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { presetRange, type RangeSelection, type PresetKey } from '@/lib/date-range';
import { todayBRT, addDays } from '@/lib/resumo-diario';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const nf = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (s: string) => { try { return format(new Date(`${s}T12:00:00`), 'dd/MM', { locale: ptBR }); } catch { return s; } };

// Tons de texto AA (WCAG) — os tons 600 reprovam contraste em fontes pequenas (11-12px);
// dots/barras seguem 500 normalmente (área maior, não precisa do mesmo contraste de texto).
const COR: Record<FarolCor, { dot: string; bar: string; text: string; ring: string; bg: string }> = {
  verde: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-500/20', bg: 'bg-emerald-50' },
  amarelo: { dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-500/20', bg: 'bg-amber-50' },
  vermelho: { dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-500/20', bg: 'bg-red-50' },
  // `neutro` = recorte de período sem dia útil → não há meta, logo não há status.
  // Cinza de propósito: dado é neutro; verde/âmbar/vermelho são status.
  neutro: { dot: 'bg-slate-300', bar: 'bg-slate-300', text: 'text-slate-500', ring: 'ring-slate-400/20', bg: 'bg-slate-50' },
};

const ESFORCO_ITEMS: { key: keyof WeekMetric['esforco']; label: string }[] = [
  { key: 'ligacoes', label: 'Ligações' },
  { key: 'emails', label: 'Emails' },
  { key: 'apresentacoes', label: 'Apresentações' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'reunioes', label: 'Reuniões' },
];

function weekLabel(w: WeekMetric): string {
  return `${fmt(w.weekStart)}–${fmt(w.weekEnd)}`;
}

function DeltaBadge({ v, label }: { v: number | null; label?: string }) {
  if (v === null) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">{label ? `${label} —` : '—'}</span>;
  }
  const flat = v === 0;
  const up = v > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  // Queda de esforço = atenção, não incêndio — âmbar, nunca vermelho (§Padrões).
  const cls = flat ? 'text-slate-400' : up ? 'text-emerald-700' : 'text-amber-700';
  const txt = `${up && !flat ? '+' : ''}${Math.round(v * 100)}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cls}`}>
      <Icon size={12} strokeWidth={2.5} />
      {label ? `${label} ${txt}` : txt}
    </span>
  );
}

// ─── Farol ao vivo (semana + mês) — receita = Venda Defenz; Repasse SS informativo ──
function FarolBucketCard({ icon: Icon, title, b, repasse }: { icon: typeof Target; title: string; b: FarolBucket; repasse: number }) {
  const c = COR[b.cor];
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
        <span className="text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 font-display tabular-nums">{brl(b.revenue)}</span>
        <span className="text-sm text-slate-400 tabular-nums">/ {brl(b.goal)}</span>
      </div>
      {repasse > 0 && (
        <p className="mt-0.5 text-[11px] text-slate-400">+ <span className="font-medium text-slate-500 tabular-nums">{brl(repasse)}</span> repasse SS (fora da meta)</p>
      )}
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
          <div className="absolute -top-2 h-2 w-[2px] bg-slate-600" style={{ left: `${expectedPct}%` }} title={`Esperado pelo ritmo: ${brl(b.expected)}`} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={`font-bold tabular-nums ${c.text}`}>{pct(b.pctAbs)} da meta</span>
        <span className="text-slate-400 tabular-nums">esperado {brl(b.expected)}</span>
      </div>
    </div>
  );
}

function FarolMetas({ res }: { res: MetasResponse }) {
  if (!res.farol) return null;
  const rep = res.farolRepasse;
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Farol — onde estou agora</h2>
        <span className="text-[11px] text-slate-400">meta R$ 6.000/semana · ao vivo</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <FarolBucketCard icon={Target} title="Semana" b={res.farol.semana} repasse={rep?.semana.revenue ?? 0} />
        <FarolBucketCard icon={CalendarDays} title="Mês" b={res.farol.mes} repasse={rep?.mes.revenue ?? 0} />
      </div>
    </div>
  );
}

// ─── Faturamento completo (hero) — Venda Defenz | Repasse SS | Total ───────────
function FaturamentoCompletoCard({ c }: { c: MetasConsolidado }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 border-t-2 border-t-red-600 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Faturamento completo · {c.nWeeks} semana{c.nWeeks === 1 ? '' : 's'}</h2>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Venda Defenz</p>
          <p className="text-2xl font-semibold text-slate-700 tabular-nums">{brl(c.revenue)}</p>
          <p className="text-xs text-slate-400">{c.dealsDefenz} venda{c.dealsDefenz === 1 ? '' : 's'}{c.dealsDefenz ? ` · ticket ${brl(Math.round(c.revenue / c.dealsDefenz))}` : ''}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Repasse SS</p>
          <p className="text-2xl font-semibold text-slate-500 tabular-nums">{brl(c.revenueRepasse)}</p>
          <p className="text-xs text-slate-400">{c.dealsRepasse} repasse{c.dealsRepasse === 1 ? '' : 's'}</p>
        </div>
        <div className="border-l border-slate-200 pl-6">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total</p>
          <p className="text-4xl font-semibold text-slate-900 tabular-nums">{brl(c.revenueTotal)}</p>
          <p className="text-xs text-slate-400">faturamento do período</p>
        </div>
      </div>
    </div>
  );
}

// ─── Consolidado do intervalo (Σ receita / Σ esforço da janela de semanas) ──────
function ConsolidadoCard({ c }: { c: MetasConsolidado }) {
  const cor = COR[c.cor];
  const fill = Math.min(Math.max(c.pctAbs, 0), 1) * 100;
  return (
    <div className={`rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5 ring-1 ${cor.ring}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Consolidado do período</h2>
          <p className="text-xs text-slate-400 mt-0.5">{fmt(c.weekStart)}–{fmt(c.weekEnd)} · {c.nWeeks} {c.nWeeks === 1 ? 'semana' : 'semanas'}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cor.bg} ${cor.text}`}>
          <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
          {c.label}
        </span>
      </div>

      <div className="relative mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-y-0 left-0 rounded-full ${cor.bar}`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={`font-bold tabular-nums ${cor.text}`}>{pct(c.pctAbs)} da meta do período</span>
        <span className="text-slate-400">esforço somado (Seg–Sex)</span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ESFORCO_ITEMS.map(it => (
          <div key={it.key} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{it.label}</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">{nf(c.esforco[it.key])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── "Por que bati / não bati" (uma semana fechada) ─────────────────────────────
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

// Tooltip customizado: total (Venda Defenz + Repasse SS) + Meta + Esforço.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReceitaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { receitaTotal: number } | undefined;
  return (
    <div className="rounded-lg bg-white border border-slate-200 shadow-lg shadow-slate-200/60 px-3 py-2 text-xs">
      <p className="font-semibold text-slate-900 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {p.dataKey === 'esforcoTotal' ? nf(Number(p.value) || 0) : brl(Number(p.value) || 0)}
        </p>
      ))}
      {row && (
        <p className="mt-1 pt-1 border-t border-slate-100 font-semibold text-slate-900 tabular-nums">
          Total: {brl(row.receitaTotal)}
        </p>
      )}
    </div>
  );
}

// Uma linha por semana (mais antiga → mais recente), reusada pelos 3 gráficos independentes.
interface ChartRow {
  label: string;
  receitaDefenz: number;
  receitaRepasse: number;
  receitaTotal: number;
  meta: number;
  esforcoTotal: number;
  parcial: boolean;
  emCurso: boolean;
}

function buildChartData(semanas: WeekMetric[], hoje: string): ChartRow[] {
  return [...semanas].reverse().map(w => ({
    label: weekLabel(w),
    receitaDefenz: w.revenue,
    receitaRepasse: w.revenueRepasse,
    receitaTotal: w.revenueTotal,
    meta: w.goal,
    parcial: w.parcial,
    emCurso: hoje >= w.weekStart && hoje <= w.weekEnd,
    esforcoTotal:
      w.esforco.ligacoes + w.esforco.emails + w.esforco.apresentacoes + w.esforco.propostas + w.esforco.reunioes,
  }));
}

const labelK = (label: string | number | boolean | null | undefined) => {
  const v = Number(label) || 0;
  return v ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : '';
};
const tickK = (v: number) => `${v / 1000}k`;

// Gráfico A — Receita Defenz vs Meta. Cor de dado por atingimento (nunca vermelho por padrão):
// grafite (bateu) · cinza médio (quase, ≥80%) · cinza claro (abaixo). Semana em curso (última
// barra) some com opacidade — evita "acusar" uma semana que mal começou.
function ReceitaMetaChart({ data, isInterval }: { data: ChartRow[]; isInterval: boolean }) {
  const barColor = (rev: number, meta: number) => {
    const pctAbs = meta > 0 ? rev / meta : 0;
    if (pctAbs >= 1) return '#334155';
    if (pctAbs >= 0.8) return '#94a3b8';
    return '#cbd5e1';
  };
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">
        {isInterval ? `Receita Defenz vs Meta — semana a semana (${data.length})` : `Receita Defenz vs Meta — últimas ${data.length} semanas`}
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis domain={[0, (max: number) => Math.max(max, 8000)]} tickFormatter={tickK} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReTooltip content={ReceitaTooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Line type="monotone" dataKey="meta" name="Meta da semana" stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Bar dataKey="receitaDefenz" name="Venda Defenz" minPointSize={3} maxBarSize={48} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="receitaDefenz" position="top" formatter={labelK} style={{ fontSize: 11, fill: '#64748b' }} />
            {data.map((row) => (
              <Cell key={row.label} fill={barColor(row.receitaDefenz, row.meta)} fillOpacity={row.emCurso ? 0.45 : 1} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-slate-400">
        {data.some(d => d.emCurso) ? 'barra clara = semana em curso · ' : ''}
        {data.some(d => d.parcial) ? 'semana parcial = recortada pelo período (meta proporcional)' : 'meta de R$ 6.000 por semana inteira'}
      </p>
    </div>
  );
}

// Gráfico B — Repasse SS. Informativo: não conta na meta semanal, por isso um único
// neutro claro (sem gradação por atingimento — não há "meta" pro repasse).
function RepasseChart({ data }: { data: ChartRow[] }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Repasse SS</h2>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis tickFormatter={tickK} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReTooltip content={ReceitaTooltip} />
          <Bar dataKey="receitaRepasse" name="Repasse SS" fill="#cbd5e1" maxBarSize={48} radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-slate-400">Informativo — não conta na meta semanal.</p>
    </div>
  );
}

// Delta de eficiência: guarda de amostra (< 3) suprime a variação — "— amostra pequena",
// nunca vermelho (queda de índice = atenção, não incêndio).
function EficienciaDeltaTag({ v }: { v: number | null }) {
  if (v === null) {
    return <span className="text-[11px] text-slate-400">— amostra pequena</span>;
  }
  const flat = v === 0;
  const up = v > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat ? 'text-slate-400' : up ? 'text-emerald-700' : 'text-amber-700';
  const txt = `${up && !flat ? '+' : ''}${Math.round(v * 100)}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cls}`}>
      <Icon size={12} strokeWidth={2.5} />
      {txt}
    </span>
  );
}

// 4 tiles de eficiência Esforço→Vendas (spec §5b). null → "—"; fração crua na sub-linha.
function EficienciaGrid({ eficiencia, c }: { eficiencia: MetasEficiencia; c: MetasConsolidado }) {
  const { atual, delta, labelComparacao } = eficiencia;
  const items: { label: string; value: string; delta: number | null; fracao: string }[] = [
    {
      label: 'Ticket médio',
      value: atual.ticketMedio === null ? '—' : brl(atual.ticketMedio),
      delta: delta.ticketMedio,
      fracao: `${brl(c.revenue)} ÷ ${c.dealsDefenz} venda${c.dealsDefenz === 1 ? '' : 's'}`,
    },
    {
      label: 'R$ / proposta',
      value: atual.rsPorProposta === null ? '—' : brl(atual.rsPorProposta),
      delta: delta.rsPorProposta,
      fracao: `${brl(c.revenue)} ÷ ${nf(c.esforco.propostas)} proposta${c.esforco.propostas === 1 ? '' : 's'}`,
    },
    {
      label: 'Propostas / 100 ligações',
      value: atual.propostasPor100Ligacoes === null ? '—' : atual.propostasPor100Ligacoes.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
      delta: delta.propostasPor100Ligacoes,
      fracao: `${nf(c.esforco.propostas)} propostas ÷ ${nf(c.esforco.ligacoes)} ligações`,
    },
    {
      label: 'Reunião → proposta',
      value: atual.reuniaoParaProposta === null ? '—' : pct(atual.reuniaoParaProposta),
      delta: delta.reuniaoParaProposta,
      fracao: `${nf(c.esforco.propostas)} propostas ÷ ${nf(c.esforco.reunioes)} reuniões`,
    },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(it => (
          <div key={it.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{it.label}</p>
            <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{it.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{it.fracao}</p>
            <div className="mt-1"><EficienciaDeltaTag v={it.delta} /></div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{labelComparacao}</p>
    </div>
  );
}

// Gráfico C — Esforço → Vendas: linha do tempo dual-axis (barras = receita, linha = esforço)
// + índices de eficiência do período selecionado. Eixos rotulados e coloridos (R$ / ações).
function EsforcoVendasCard({ data, eficiencia, c }: { data: ChartRow[]; eficiencia: MetasEficiencia; c: MetasConsolidado }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-1">Esforço → Vendas</h2>
      <p className="text-[11px] text-slate-400 mb-3">barras = receita · linha = esforço (qtde de ações)</p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis
            yAxisId="rev"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={tickK}
            label={{ value: 'R$', position: 'insideTopLeft', fill: '#64748b', fontSize: 11 }}
          />
          <YAxis
            yAxisId="esf"
            orientation="right"
            tick={{ fill: '#0284c7', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            label={{ value: 'ações', position: 'insideTopRight', fill: '#0284c7', fontSize: 11 }}
          />
          <ReTooltip content={ReceitaTooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Bar yAxisId="rev" dataKey="receitaDefenz" name="Receita" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line yAxisId="esf" type="monotone" dataKey="esforcoTotal" name="Esforço (ações)" stroke="#0284c7" strokeWidth={2} dot={{ r: 3, fill: '#fff', stroke: '#0284c7', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-slate-400 italic">Esforço vende com atraso — compare tendências, não a mesma semana.</p>

      <div className="mt-5 pt-5 border-t border-slate-100">
        <EficienciaGrid eficiencia={eficiencia} c={c} />
      </div>
    </div>
  );
}

// Presets do seletor de período (spec §6) — segmented control em linha própria.
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '8sem', label: '8 sem' },
  { key: '12sem', label: '12 sem' },
  { key: 'este-mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'trimestre', label: 'Trimestre' },
];

function isActivePreset(sel: RangeSelection | null, key: PresetKey, today: string): boolean {
  if (!sel || sel.kind !== 'periodo') return false;
  const p = presetRange(key, today);
  return p.kind === 'periodo' && p.from === sel.from && p.to === sel.to;
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export const MetasDashboard = () => {
  const today = useMemo(() => todayBRT(), []);
  const floor = useMemo(() => addDays(today, -364), [today]);

  const [sel, setSel] = useState<RangeSelection | null>(null); // null = padrão (últimas 8 semanas)
  const [response, setResponse] = useState<MetasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default (`sel === null`, rotulado "Últimas 8 semanas") emite EXATAMENTE o mesmo range
  // do preset "8 sem". Antes o default caía no caminho sem range (8 semanas ISO inteiras) e
  // o preset recortava a semana em curso em `to=today`: os dois botões cobriam as mesmas 8
  // semanas e, com meta proporcional, passariam a mostrar metas diferentes.
  const query = useMemo(() => {
    const efetivo = sel ?? presetRange('8sem', today);
    return efetivo.kind === 'dia'
      ? `from=${efetivo.data}&to=${efetivo.data}`
      : `from=${efetivo.from}&to=${efetivo.to}`;
  }, [sel, today]);

  const fetchData = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metas${q ? `?${q}` : ''}`);
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const json = (await res.json()) as MetasResponse;
      setResponse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(query); }, [fetchData, query]);

  const semanas = useMemo(() => response?.semanas ?? [], [response]);
  const isInterval = !!response?.periodo;
  // "Bati/não bati" (modo padrão) → última semana FECHADA (semanas[1]); semanas[0] é a atual em andamento.
  const retro = semanas.length > 1 ? semanas[1] : semanas[0];
  const hojeISO = useMemo(() => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), []);
  const chartData = useMemo(() => buildChartData(semanas, hojeISO), [semanas, hojeISO]);

  const selLabel = !sel
    ? 'Últimas 8 semanas'
    : sel.kind === 'dia' ? `Semana de ${fmt(sel.data)}` : `${fmt(sel.from)} – ${fmt(sel.to)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 font-display">Farol de Metas</h1>
            <p className="text-sm text-slate-500 mt-1">Meta semanal: <span className="font-semibold text-slate-700">R$ 6.000</span> · só Venda Defenz — Repasse SS é informativo</p>
          </div>
          <div className="flex items-center gap-2">
            {response?._cached && <span className="text-xs text-amber-500">cache</span>}
            <button
              onClick={() => fetchData(query)}
              disabled={loading}
              title="Atualizar"
              className="p-2 rounded-full bg-white/80 border border-slate-200/60 text-slate-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full p-1 shadow-sm">
            {PRESETS.map(p => {
              const active = isActivePreset(sel, p.key, today);
              return (
                <button
                  key={p.key}
                  onClick={() => setSel(presetRange(p.key, today))}
                  disabled={loading}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50 ${
                    active ? 'bg-red-600 text-white' : 'text-slate-600 hover:text-red-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full p-1 shadow-sm">
            <DateRangePicker
              value={sel ?? { kind: 'dia', data: today }}
              floor={floor}
              today={today}
              onChange={setSel}
              disabled={loading}
              numberOfMonths={2}
              hint="Escolha 1 semana (1 clique) ou um intervalo de semanas (2 cliques)"
              trigger={
                <button className="px-3 py-1 flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-red-600 transition-colors">
                  <CalendarDays size={14} className="text-red-500" />
                  <span className="whitespace-nowrap">{selLabel}</span>
                </button>
              }
            />
            {sel && (
              <button onClick={() => setSel(null)} title="Voltar ao padrão (8 semanas)" className="p-1.5 rounded-full text-slate-400 hover:bg-slate-50 hover:text-red-600 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle size={36} className="text-red-500 mb-3" />
          <p className="text-slate-600">{error}</p>
          <button onClick={() => fetchData(query)} className="mt-4 px-4 py-2 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
            Tentar novamente
          </button>
        </div>
      ) : loading && !response ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 size={36} className="animate-spin text-red-500 mb-4" />
          <p className="text-slate-400 text-sm">Carregando metas...</p>
        </div>
      ) : !semanas.length ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Target size={32} className="text-slate-300 mb-3" />
          <p className="text-lg text-slate-600">Sem dados suficientes para calcular as metas</p>
          <p className="text-sm text-slate-400 mt-2">Verifique se as abas `resumo_diario` e `deals` estão populadas.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          <p className="text-xs text-slate-400">
            Aqui a meta conta só a <span className="font-medium text-slate-500">Venda Defenz</span>; o Repasse SS é informativo. O esforço (ligações, e-mails, apresentações, propostas, reuniões) conta de <span className="font-medium text-slate-500">segunda a sexta</span>; a receita segue atribuída à semana inteira (Seg–Dom).
          </p>

          {response?.consolidado && <FaturamentoCompletoCard c={response.consolidado} />}

          {response && <FarolMetas res={response} />}

          {isInterval && response?.consolidado
            ? <ConsolidadoCard c={response.consolidado} />
            : retro && <PorqueBloco w={retro} isRetro={semanas.length > 1} />}

          {semanas.length > 1 && (
            <>
              <ReceitaMetaChart data={chartData} isInterval={isInterval} />
              <RepasseChart data={chartData} />
            </>
          )}

          {response?.eficiencia && response?.consolidado && (
            <EsforcoVendasCard data={chartData} eficiencia={response.eficiencia} c={response.consolidado} />
          )}
        </motion.div>
      )}
    </div>
  );
};
