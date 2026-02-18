"use client";

import {
  Users, Zap, DollarSign, Trophy, Percent, BarChart3,
  AlertTriangle, RefreshCcw, Loader2, UserCheck, Download
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { DealsTable } from '@/components/dashboard/DealsTable';
import { PartnersCard } from '@/components/dashboard/PartnersCard';
import { LastClientCard } from '@/components/dashboard/LastClientCard';
import { ErrorState } from '@/components/shared/ErrorState';
import { MagicCard } from '@/components/ui/MagicCard';
import { DailyEffortChart } from '@/components/operational/charts/DailyEffortChart';
import { EsforcoSection } from '@/components/dashboard/EsforcoSection';
import { AgendaSection } from '@/components/dashboard/AgendaSection';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEsforcoDiario } from '@/hooks/useEsforcoDiario';
import { useEsforcoData } from '@/hooks/useEsforcoData';
import { useAgendaData } from '@/hooks/useAgendaData';
import { useDateRange } from '@/providers/DateRangeProvider';
import { formatCurrency, getDateBounds } from '@/lib/formatters';
import type { DataSource } from '@/lib/types';

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

export const ExecutiveDashboard = () => {
  const [exporting, setExporting] = useState(false);
  const { dateRange } = useDateRange();
  const {
    data,
    loading,
    error,
    warnings,
    dataSource,
    funnelData,
    filteredDealsAtivos,
    filteredClientesFechados,
    trends,
    comparisonLabel,
    comparisonDeltas,
    comparisonValues,
    fetchData,
  } = useDashboardData(dateRange);

  const { data: efpiData, loading: efpiLoading } = useEsforcoDiario();
  const { data: esforcoData, loading: esforcoLoading } = useEsforcoData();
  const { data: agendaData, loading: agendaLoading } = useAgendaData();
  const dateBounds = getDateBounds(dateRange);

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

        {/* Hero Card: Comissão Ganha */}
        <div>
          <StatCard
            loading={loading}
            icon={Trophy}
            title="Comissao Ganha"
            value={data ? formatCurrency(data.comissao_fechado) : "-"}
            subtext={`${data?.deals_fechados || 0} negocios ganhos — Total: ${data ? formatCurrency(data.valor_fechado) : '-'}`}
            highlight={true}
            heroSize={true}
            trend={hasComparison ? trends.comissao_fechado as 'up' | 'down' | undefined : undefined}
            comparisonLine={buildComparisonLine('comissao_fechado', 'currency')}
            tooltip="Soma das comissoes dos deals fechados no periodo selecionado."
          />
        </div>

        {/* Support Cards: 5 cards in a row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            loading={loading}
            icon={DollarSign}
            title="Pipeline"
            value={data ? formatCurrency(data.comissao_pipeline) : "-"}
            subtext={`${data?.deals_pipeline || 0} deals c/ proposta — ${data ? formatCurrency(data.valor_pipeline) : '-'}`}
            highlight={true}
            tooltip="Comissao dos deals com proposta na rua (Proposta Enviada, Em negociacao, Negociacao/Revisao). Taxas: Direto 58%, Parceiro 43%, SecuriSoft 5%."
          />
          <StatCard
            loading={loading}
            icon={Percent}
            title="Win Rate"
            value={data ? `${data.win_rate}%` : "-"}
            subtext={
              !data?.deals_fechados
                ? 'Sem fechamentos'
                : `${data.deals_fechados} ganhos de ${data.deals_fechados + Math.round(data.deals_fechados * (100 - (data.win_rate || 0)) / Math.max(data.win_rate || 1, 1))} total`
            }
            trend={hasComparison ? trends.win_rate as 'up' | 'down' | undefined : undefined}
            comparisonLine={buildComparisonLine('win_rate', 'percent', true)}
            tooltip="Percentual de deals ganhos sobre o total de finalizados (ganhos + perdidos)."
          />
          <StatCard
            loading={loading}
            icon={BarChart3}
            title="Ticket Medio"
            value={data ? formatCurrency(data.ticket_medio) : "-"}
            subtext="Valor medio por deal"
            trend={hasComparison ? trends.ticket_medio as 'up' | 'down' | undefined : undefined}
            comparisonLine={buildComparisonLine('ticket_medio', 'currency', true)}
            tooltip="Valor medio por deal fechado no periodo (valor total / quantidade)."
          />
          <StatCard
            loading={loading}
            icon={Zap}
            title="Conectividade"
            value={data ? `${data.taxa_conectividade}%` : "-"}
            subtext={`${data?.ligacoes_atendidas || 0} de ${data?.ligacoes || 0} ligacoes`}
            trend={hasComparison ? trends.taxa_conectividade as 'up' | 'down' | undefined : undefined}
            comparisonLine={buildComparisonLine('taxa_conectividade', 'percent', true)}
            tooltip="Percentual de ligacoes atendidas sobre o total de ligacoes realizadas."
          />
          <StatCard
            loading={loading}
            icon={Users}
            title="Ultimo Fechamento"
            value={data?.ultimo_cliente.valor ? formatCurrency(data.ultimo_cliente.valor) : "-"}
            subtext={data?.ultimo_cliente.nome || "Nenhum recente"}
            highlight={true}
            tooltip="Valor do deal mais recente fechado como ganho no periodo."
          />
        </div>

        {/* Contatos Qualificados — conditional render */}
        {data && data.contatos_decisor > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 max-w-lg">
            <StatCard
              loading={loading}
              icon={UserCheck}
              title="Contato c/ Decisor"
              value={String(data.contatos_decisor)}
              subtext="Deals marcados com [DECISOR]"
              tooltip="Quantidade de deals criados no periodo cujo campo Resultados contem a tag [DECISOR]."
            />
            <StatCard
              loading={loading}
              icon={UserCheck}
              title="Decisor + Info"
              value={String(data.contatos_decisor_info)}
              subtext={data.contatos_decisor > 0
                ? `${Math.round((data.contatos_decisor_info / data.contatos_decisor) * 100)}% dos contatos c/ decisor`
                : "Nenhum contato com decisor"}
              tooltip="Deals com [DECISOR_INFO]: contato com decisor E informacoes tecnicas coletadas."
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funnel Chart Section */}
          <div className="lg:col-span-2 h-[500px]">
            <FunnelChart data={funnelData} />
          </div>

          {/* Side Column: Partners & Executive Summary */}
          <div className="space-y-6">
            <PartnersCard partners={data?.parceiros} loading={loading} />
            <LastClientCard client={data?.ultimo_cliente} loading={loading} />
          </div>
        </div>

        {/* Daily Effort Chart */}
        <MagicCard className="border-slate-200/60 bg-white/60 overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display">
              Esforco por Dia
            </p>
          </div>
          <div className="px-4 pb-4">
            {efpiLoading ? (
              <div className="h-[260px] bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <div className="h-[260px]">
                <DailyEffortChart
                  efpiData={efpiData}
                  dataInicio={dateBounds.data_inicio}
                  dataFim={dateBounds.data_fim}
                />
              </div>
            )}
          </div>
        </MagicCard>

        {/* Funil de Esforco Comercial (IA) */}
        <EsforcoSection data={esforcoData} loading={esforcoLoading} />

        {/* Agenda de Prospeccao */}
        <AgendaSection data={agendaData} loading={agendaLoading} />

        {/* Data Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DealsTable deals={filteredDealsAtivos} type="active" loading={loading} />
          <DealsTable deals={filteredClientesFechados} type="closed" loading={loading} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
