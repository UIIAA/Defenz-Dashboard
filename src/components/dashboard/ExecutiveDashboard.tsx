"use client";

import {
  Phone, Calendar, Presentation, FileText, Trophy,
  AlertTriangle, RefreshCcw, Loader2, Download, DollarSign
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataHealthPanel, getHealth } from '@/components/dashboard/DataHealthPanel';
import { ErrorState } from '@/components/shared/ErrorState';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDateRange } from '@/providers/DateRangeProvider';
import { formatCurrency } from '@/lib/formatters';
import type { DataSource, CoverageSourceStats, ReceitaPorCanalMetrics } from '@/lib/types';

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

const CANAL_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  direto:      { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500' },
  parceiro:    { bg: 'bg-violet-50', text: 'text-violet-700', bar: 'bg-violet-500' },
  securisoft:  { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500' },
};

const ReceitaPorCanalSection = ({
  receita,
  loading,
}: {
  receita: ReceitaPorCanalMetrics;
  loading: boolean;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <DollarSign size={16} className="text-slate-400" />
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Financeiro — Receita por Canal</h2>
    </div>

    {/* Barra de proporção horizontal */}
    <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
      {receita.canais.map(c => (
        c.percentual > 0 && (
          <div
            key={c.categoria}
            className={`${CANAL_COLORS[c.categoria]?.bar ?? 'bg-slate-400'} transition-all duration-700`}
            style={{ width: `${c.percentual}%` }}
            title={`${c.label}: ${c.percentual}%`}
          />
        )
      ))}
    </div>

    {/* Cards por canal */}
    <div className="grid grid-cols-3 gap-4">
      {receita.canais.map(canal => {
        const colors = CANAL_COLORS[canal.categoria] ?? { bg: 'bg-slate-50', text: 'text-slate-700', bar: 'bg-slate-400' };
        return (
          <div
            key={canal.categoria}
            className={`${colors.bg} rounded-xl p-4 border border-white/60 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                {canal.label}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 ${colors.text}`}>
                {canal.percentual}%
              </span>
            </div>
            <p className={`text-xl font-bold ${colors.text} tabular-nums`}>
              {formatCurrency(canal.valor_fechado)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Comissao: {formatCurrency(canal.comissao_fechado)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {canal.deals} {canal.deals === 1 ? 'deal' : 'deals'} fechados
            </p>
          </div>
        );
      })}
    </div>

    {/* Totais */}
    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
      <span>Total: <span className="font-semibold text-slate-700">{formatCurrency(receita.total_valor)}</span></span>
      <span>Comissao total: <span className="font-semibold text-slate-700">{formatCurrency(receita.total_comissao)}</span></span>
      <span>{receita.total_deals} deals fechados no periodo</span>
    </div>
  </div>
);

export const ExecutiveDashboard = () => {
  const [exporting, setExporting] = useState(false);
  const { dateRange } = useDateRange();
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
            subtext={data ? `Pipeline: ${formatCurrency(data.valor_pipeline)}` : ""}
            highlight={true}
            healthStatus={coverage ? getHealth(coverage.deals) : undefined}
            tooltip={<CoverageTooltip
              base="Deals com Stage 'Proposta Enviada' ou [PROPOSTA]. Pipeline = soma dos valores."
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
          <ReceitaPorCanalSection receita={receitaPorCanal} loading={loading} />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
