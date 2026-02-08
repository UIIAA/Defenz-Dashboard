"use client";

import {
  Users, Zap, DollarSign, Trophy, Percent, BarChart3,
  AlertTriangle, RefreshCcw, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { DealsTable } from '@/components/dashboard/DealsTable';
import { PartnersCard } from '@/components/dashboard/PartnersCard';
import { LastClientCard } from '@/components/dashboard/LastClientCard';
import { ErrorState } from '@/components/shared/ErrorState';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDateRange } from '@/providers/DateRangeProvider';
import { formatCurrency } from '@/lib/formatters';
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
    fetchData,
  } = useDashboardData(dateRange);

  if (error) {
    return <ErrorState error={error} onRetry={() => fetchData(dateRange)} />;
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
        className="space-y-6"
      >
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
              onClick={() => fetchData(dateRange)}
              disabled={loading}
              className="p-2 bg-white/80 border border-slate-200/60 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-red-600 shadow-sm disabled:opacity-50"
              title="Atualizar Dados"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Executive Stats Grid - 6 cards, 2 rows of 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            loading={loading}
            icon={DollarSign}
            title="Comissao Pipeline"
            value={data ? formatCurrency(data.comissao_pipeline) : "-"}
            subtext={`${filteredDealsAtivos.length} deals ativos — Pipeline: ${data ? formatCurrency(data.valor_pipeline) : '-'}`}
            highlight={true}
            tooltip="Soma das comissoes de todos os deals ativos. Taxas: Direto 58%, Parceiro 43%, SecuriSoft 5%."
          />
          <StatCard
            loading={loading}
            icon={Trophy}
            title="Comissao Ganha"
            value={data ? formatCurrency(data.comissao_fechado) : "-"}
            subtext={`${data?.deals_fechados || 0} negocios ganhos — Total: ${data ? formatCurrency(data.valor_fechado) : '-'}`}
            highlight={true}
            tooltip="Soma das comissoes dos deals fechados no periodo selecionado."
          />
          <StatCard
            loading={loading}
            icon={Percent}
            title="Win Rate"
            value={data ? `${data.win_rate}%` : "-"}
            subtext={
              !data?.deals_fechados
                ? 'Sem fechamentos no periodo'
                : `${data.deals_fechados} ganhos de ${data.deals_fechados + Math.round(data.deals_fechados * (100 - (data.win_rate || 0)) / Math.max(data.win_rate || 1, 1))} total`
            }
            tooltip="Percentual de deals ganhos sobre o total de finalizados (ganhos + perdidos)."
          />
          <StatCard
            loading={loading}
            icon={BarChart3}
            title="Ticket Medio"
            value={data ? formatCurrency(data.ticket_medio) : "-"}
            subtext="Valor medio por deal"
            tooltip="Valor medio por deal fechado no periodo (valor total / quantidade)."
          />
          <StatCard
            loading={loading}
            icon={Zap}
            title="Taxa Conectividade"
            value={data ? `${data.taxa_conectividade}%` : "-"}
            subtext={`${data?.ligacoes_atendidas || 0} de ${data?.ligacoes || 0} ligacoes`}
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

        {/* Data Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DealsTable deals={filteredDealsAtivos} type="active" loading={loading} />
          <DealsTable deals={filteredClientesFechados} type="closed" loading={loading} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
