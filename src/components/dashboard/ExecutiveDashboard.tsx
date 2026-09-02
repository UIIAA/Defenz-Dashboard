"use client";

import {
  Phone, Calendar, Presentation, FileText, Trophy,
  AlertTriangle, RefreshCcw, Loader2, Download, DollarSign, Pencil
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataHealthPanel, getHealth } from '@/components/dashboard/DataHealthPanel';
import { ChannelTargetsEditor } from '@/components/dashboard/ChannelTargetsEditor';
import { ErrorState } from '@/components/shared/ErrorState';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useChannelTargets } from '@/hooks/useChannelTargets';
import { useDateRange } from '@/providers/DateRangeProvider';
import { formatCurrency, getDateBounds } from '@/lib/formatters';
import { metaPeriodo, diasNoPeriodo } from '@/lib/metas-canal';
import { grade } from '@/lib/farol';
import type { DataSource, CoverageSourceStats, ReceitaPorCanalMetrics, ChannelTargets, CanalCategoria, FarolCor } from '@/lib/types';

const CoverageTooltip = ({
  base, aba, coluna, stats,
}: {
  base: string;
  aba: string;
  coluna: string;
  stats?: CoverageSourceStats;
}) => (
  <div className="space-y-1">
    <p>{base}</p>
    <p className="text-slate-400 border-t border-slate-600 pt-1 mt-1">
      Fonte: planilha <span className="font-mono text-white/80">{aba}</span> · col <span className="font-mono text-white/80">{coluna}</span>
    </p>
    {stats && (
      <p className="text-slate-400">
        Cobertura: {stats.min_date ?? '?'} → {stats.max_date ?? '?'} · {stats.in_range} no período
        {stats.dropped_invalid_date > 0 && ` · ${stats.dropped_invalid_date} inválidos`}
      </p>
    )}
  </div>
);

const DataSourceBadge = ({ source }: { source: DataSource }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
    source === 'cache' ? 'bg-blue-100 text-blue-600' :
    source === 'sheets' ? 'bg-green-100 text-green-600' :
    source === 'n8n' ? 'bg-amber-100 text-amber-600' :
    'bg-slate-100 text-slate-500'
  }`}>
    {source === 'cache' ? 'Cache' :
     source === 'sheets' ? 'Planilha' :
     source === 'n8n' ? 'N8N' : 'Mock'}
  </span>
);

// feature-metas-canal (Spec 2, §3): identidade de CANAL é dado neutro (grafite →
// cinza claro), nunca cor de alarme — SecuriSoft não pode "ler" como vermelho.
// Cor de STATUS (atingimento de meta) é separada e usa a paleta de farol.
const CANAL_DOT: Record<string, string> = {
  direto:      'bg-slate-700',   // #334155
  parceiro:    'bg-slate-500',   // #64748b
  securisoft:  'bg-slate-300',   // #cbd5e1
};

const STATUS_BAR: Record<FarolCor, string> = {
  verde: 'bg-emerald-500',
  amarelo: 'bg-amber-500',
  vermelho: 'bg-red-500',
  neutro: 'bg-slate-300',   // sem meta definida no período — dado, não status
};

const STATUS_TEXT: Record<FarolCor, string> = {
  verde: 'text-emerald-700',
  amarelo: 'text-amber-700',
  vermelho: 'text-red-700',
  neutro: 'text-slate-500',
};

// Barra de atingimento (meta <= 0 → some, per spec §1: meta não definida esconde
// a barra/status e mostra só o valor).
const AttainmentBar = ({ valor, meta, label }: { valor: number; meta: number; label: string }) => {
  if (meta <= 0) return null;
  const cor = grade(valor, meta, meta).cor;
  const pct = Math.round((valor / meta) * 100);
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
        <div className={`h-full ${STATUS_BAR[cor]} transition-all duration-700`} style={{ width: `${width}%` }} />
      </div>
      <p className={`text-[11px] font-semibold ${STATUS_TEXT[cor]}`}>
        {label} · {pct}% da meta do período
      </p>
    </div>
  );
};

const ReceitaPorCanalSection = ({
  receita,
  loading,
  targets,
  metaCanal,
  canEdit,
  onReload,
}: {
  receita: ReceitaPorCanalMetrics;
  loading: boolean;
  targets: ChannelTargets | null;
  metaCanal: ChannelTargets;
  canEdit: boolean;
  onReload: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const totalMeta = metaCanal.direto + metaCanal.parceiro + metaCanal.securisoft;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Financeiro — Receita por Canal</h2>
        </div>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            title="Editar metas por canal"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {isEditing && targets ? (
        <ChannelTargetsEditor
          targets={targets}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            onReload();
            setIsEditing(false);
          }}
        />
      ) : (
        <>
          {/* Barra de proporção horizontal — identidade neutra por canal (dado) */}
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {receita.canais.map(c => (
              c.percentual > 0 && (
                <div
                  key={c.categoria}
                  className={`${CANAL_DOT[c.categoria] ?? 'bg-slate-400'} transition-all duration-700`}
                  style={{ width: `${c.percentual}%` }}
                  title={`${c.label}: ${c.percentual}%`}
                />
              )
            ))}
          </div>

          {/* Cards por canal */}
          <div className="grid grid-cols-3 gap-4">
            {receita.canais.map(canal => {
              const meta = metaCanal[canal.categoria as CanalCategoria] ?? 0;
              return (
                <div
                  key={canal.categoria}
                  className="rounded-xl p-4 border border-slate-200/70 bg-slate-50/60 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <span className={`h-2 w-2 rounded-full ${CANAL_DOT[canal.categoria] ?? 'bg-slate-400'}`} />
                      {canal.label}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 text-slate-500">
                      {canal.percentual}% do total
                    </span>
                  </div>
                  <p className="text-xl font-bold text-slate-700 tabular-nums">
                    {formatCurrency(canal.valor_fechado)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Comissao: {formatCurrency(canal.comissao_fechado)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {canal.deals} {canal.deals === 1 ? 'deal' : 'deals'} fechados
                  </p>
                  <AttainmentBar valor={canal.valor_fechado} meta={meta} label={formatCurrency(meta)} />
                </div>
              );
            })}
          </div>

          {/* Consolidado Total — Σ receita vs Σ metas escaladas, mesma regra de cor */}
          <div className="rounded-xl p-4 border border-slate-300/70 bg-slate-100/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total</span>
              <span className="text-xs text-slate-400">{receita.total_deals} deals fechados no periodo</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-slate-700 tabular-nums">{formatCurrency(receita.total_valor)}</p>
              <p className="text-xs text-slate-500">Comissao total: {formatCurrency(receita.total_comissao)}</p>
            </div>
            <AttainmentBar valor={receita.total_valor} meta={totalMeta} label="Total" />
          </div>
        </>
      )}
    </div>
  );
};

export const ExecutiveDashboard = () => {
  const [exporting, setExporting] = useState(false);
  const { dateRange } = useDateRange();
  const { targets, canEdit, reload: reloadTargets } = useChannelTargets();
  const {
    data,
    loading,
    error,
    warnings,
    dataSource,
    coverage,
    receitaPorCanal,
    funnelData,
    filteredDealsAtivos,
    filteredClientesFechados,
    trends,
    comparisonLabel,
    comparisonDeltas,
    comparisonValues,
    fetchData,
  } = useDashboardData(dateRange);

  const hasComparison = comparisonLabel !== '';

  // feature-metas-canal (Spec 2, Task 4) — reusa o MESMO decode de dateRange que
  // useDashboardData/API já usam (getDateBounds, de src/lib/formatters.ts) pra
  // não inventar uma segunda leitura do preset/custom range.
  const metaCanal: ChannelTargets = useMemo(() => {
    if (!targets) return { direto: 0, parceiro: 0, securisoft: 0 };
    const { data_inicio, data_fim } = getDateBounds(dateRange);
    const dias = diasNoPeriodo(data_inicio, data_fim);
    return {
      direto: metaPeriodo(targets.direto, dias),
      parceiro: metaPeriodo(targets.parceiro, dias),
      securisoft: metaPeriodo(targets.securisoft, dias),
    };
  }, [targets, dateRange]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export/excel', { method: 'POST' });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defenz_executivo_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const buildComparisonLine = (
    key: string,
    format: 'currency' | 'percent' | 'number',
    abbreviated = false,
  ): string | undefined => {
    if (!hasComparison || comparisonValues[key] === undefined) return undefined;
    const val = comparisonValues[key];
    const formatted =
      format === 'currency' ? formatCurrency(val) :
      format === 'percent' ? `${val}%` :
      String(val);
    const prefix = abbreviated ? `Ant. ${comparisonLabel}` : `Anterior (${comparisonLabel})`;
    const delta = comparisonDeltas[key];
    const suffix = delta && delta !== '0%' ? ` · ${delta}` : '';
    return `${prefix}: ${formatted}${suffix}`;
  };

  if (error) {
    return <ErrorState error={error} onRetry={() => fetchData(dateRange, true)} />;
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={40} className="animate-spin text-red-500 mb-4" />
        <p className="text-sm text-slate-400 font-medium">Carregando dados...</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="executive"
        initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative space-y-6"
      >
        {/* Overlay spinner when reloading with existing data */}
        {loading && data && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5">
              <Loader2 size={80} className="animate-spin text-red-500" />
              <p className="text-lg text-slate-600 font-semibold tracking-wide">Atualizando dados...</p>
            </div>
          </div>
        )}
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            {data && (
              <>
                <span>Atualizado: {data.data} as {data.hora}</span>
                <DataSourceBadge source={dataSource} />
                {loading && <Loader2 size={14} className="animate-spin text-red-400" />}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {warnings.length > 0 && (
              <div className="relative group">
                <button
                  className="p-2 bg-amber-50 border border-amber-200 rounded-full text-amber-600 hover:bg-amber-100 transition-all shadow-sm"
                  title={`${warnings.length} inconsistencia(s) detectada(s)`}
                >
                  <AlertTriangle size={16} />
                </button>
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {warnings.length}
                </span>
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-amber-200 rounded-lg shadow-lg p-3 hidden group-hover:block z-50">
                  <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">Inconsistencias</p>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">&bull;</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="p-2 bg-white/80 border border-slate-200/60 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-red-600 shadow-sm disabled:opacity-50"
              title="Exportar Excel Executivo"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            </button>
            <button
              onClick={() => fetchData(dateRange, true)}
              disabled={loading}
              className="p-2 bg-white/80 border border-slate-200/60 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-red-600 shadow-sm disabled:opacity-50"
              title="Atualizar Dados"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* HERO: Funil de Vendas (full-width) */}
        <div className="h-[420px]">
          <FunnelChart data={funnelData} />
        </div>

        {/* Drill-down: Cards por estágio do funil */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            loading={loading}
            icon={Phone}
            title="Ligacoes"
            value={data ? String(data.ligacoes) : "-"}
            subtext={data ? `${data.taxa_conectividade}% atendidas (${data.ligacoes_atendidas} de ${data.ligacoes})` : ""}
            healthStatus={coverage ? getHealth(coverage.calls) : undefined}
            tooltip={<CoverageTooltip
              base="Total de ligacoes realizadas no periodo. Taxa = atendidas / total."
              aba="ligacoes" coluna="data"
              stats={coverage?.calls}
            />}
          />
          <StatCard
            loading={loading}
            icon={Calendar}
            title="Reunioes"
            value={data ? String(data.reunioes) : "-"}
            subtext={data && data.ligacoes > 0 ? `Conv: ${Math.round((data.reunioes / data.ligacoes) * 100)}% das ligacoes` : ""}
            healthStatus={coverage ? getHealth(coverage.reunioes) : undefined}
            tooltip={<CoverageTooltip
              base="Reunioes com <> no assunto do Outlook. Conversao = reunioes / ligacoes."
              aba="reunioes" coluna="data"
              stats={coverage?.reunioes}
            />}
          />
          <StatCard
            loading={loading}
            icon={Presentation}
            title="Apresentacoes"
            value={data ? String(data.apresentacoes) : "-"}
            subtext={data && data.reunioes > 0 ? `Conv: ${Math.round((data.apresentacoes / data.reunioes) * 100)}% das reunioes` : ""}
            healthStatus={coverage ? getHealth(coverage.deals) : undefined}
            tooltip={<CoverageTooltip
              base="Deals com [APRESENTACAO] no campo Resultados. Conversao = apresentacoes / reunioes."
              aba="deals" coluna="resultados"
              stats={coverage?.deals}
            />}
          />
          <StatCard
            loading={loading}
            icon={FileText}
            title="Propostas"
            value={data ? String(data.propostas) : "-"}
            subtext={
              data
                ? `Pipe aberto · ${data.deals_pipeline} ${data.deals_pipeline === 1 ? 'negócio' : 'negócios'} · ${formatCurrency(data.valor_pipeline)}`
                : ""
            }
            highlight={true}
            healthStatus={coverage ? getHealth(coverage.deals) : undefined}
            tooltip={<CoverageTooltip
              base="Deals com Stage 'Proposta Enviada' ou [PROPOSTA]. Pipe aberto = todos os negócios que NÃO estão fechados (nem ganho, nem perdido) e não estão em Contato Futuro."
              aba="deals" coluna="stage / resultados"
              stats={coverage?.deals}
            />}
          />
          <StatCard
            loading={loading}
            icon={Trophy}
            title="Fechados"
            value={data ? String(data.deals_fechados) : "-"}
            subtext={data ? `Comissao: ${formatCurrency(data.comissao_fechado)}` : ""}
            highlight={true}
            healthStatus={coverage ? getHealth(coverage.deals) : undefined}
            tooltip={<CoverageTooltip
              base="Deals fechados como ganhos no periodo. Comissao calculada por categoria."
              aba="deals" coluna="closing_date"
              stats={coverage?.deals}
            />}
          />
        </div>

        {/* Cobertura de dados (colapsável) */}
        <DataHealthPanel coverage={coverage} />

        {/* Financeiro: receita por canal */}
        {receitaPorCanal && receitaPorCanal.total_valor > 0 && (
          <ReceitaPorCanalSection
            receita={receitaPorCanal}
            loading={loading}
            targets={targets}
            metaCanal={metaCanal}
            canEdit={canEdit}
            onReload={reloadTargets}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
