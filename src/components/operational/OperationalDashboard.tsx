"use client";

import { useState, useMemo, useRef } from 'react';
import { RefreshCw, AlertTriangle, BarChart3, Clock, Users, Flame, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOperationalData } from '@/hooks/useOperationalData';
import { useOperationalCharts } from '@/hooks/useOperationalCharts';
import { useActivityMetrics } from '@/hooks/useActivityMetrics';
import { useDateRange } from '@/providers/DateRangeProvider';
import { formatCurrency, getDateBounds } from '@/lib/formatters';
import type { DailyEffort } from '@/lib/types';
import { StatCard } from '@/components/dashboard/StatCard';
import { MagicCard } from '@/components/ui/MagicCard';
import { ActivityMetricsRow } from './ActivityMetricsRow';
import { DealPipelineRow } from './DealPipelineRow';
import { PipelineByStageChart } from './charts/PipelineByStageChart';
import { PipelineHealthChart } from './charts/PipelineHealthChart';
import { AgingDistributionChart } from './charts/AgingDistributionChart';
import { CommissionByCategoryChart } from './charts/CommissionByCategoryChart';
import { DailyEffortChart } from './charts/DailyEffortChart';
import { EffortVsResultChart } from './charts/EffortVsResultChart';

type FilterMode = 'todos' | 'parados' | 'stage';

const STAGES = [
  'Qualificação',
  'Apresentação',
  'Proposta Enviada',
  'Negociação',
];

const INITIAL_VISIBLE = 10;

export const OperationalDashboard = () => {
  const { dateRange } = useDateRange();
  const { data, loading, error, fetchData } = useOperationalData();
  const { metrics: activityMetrics, loading: activityLoading } = useActivityMetrics(dateRange);
  const [filter, setFilter] = useState<FilterMode>('todos');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [listExpanded, setListExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const allDealsRecalculated = useMemo(() => {
    if (!data?.deals) return [];
    const isAllTime = dateRange === 'alltime';
    const { data_inicio, data_fim } = getDateBounds(dateRange);
    return data.deals.map(deal => {
      const activitiesInRange = isAllTime
        ? deal.activities
        : deal.activities.filter(a => {
            if (!a.data) return false;
            return a.data >= data_inicio && a.data <= data_fim;
          });
      return {
        ...deal,
        activities: activitiesInRange,
        is_stale: deal.is_stale,
      };
    });
  }, [data?.deals, dateRange]);

  const filteredDeals = useMemo(() => {
    let deals = allDealsRecalculated;

    if (filter === 'parados') {
      deals = deals.filter(d => d.is_stale);
    } else if (filter === 'stage' && stageFilter) {
      deals = deals.filter(d => d.stage === stageFilter);
    }

    return [...deals].sort((a, b) => {
      if (a.is_stale !== b.is_stale) return a.is_stale ? -1 : 1;
      return b.days_in_stage - a.days_in_stage;
    });
  }, [allDealsRecalculated, filter, stageFilter]);

  const chartData = useOperationalCharts(filteredDeals);

  // Pre-aggregated daily effort data from the esforco_diario sheet
  const efpiData = useMemo<DailyEffort[]>(() => {
    return data?.esforco_diario || [];
  }, [data?.esforco_diario]);

  // Date bounds for filtering
  const dateBounds = useMemo(() => {
    if (dateRange === 'alltime') return { data_inicio: '', data_fim: '' };
    return getDateBounds(dateRange);
  }, [dateRange]);

  const stages = useMemo(() => {
    if (allDealsRecalculated.length === 0) return STAGES;
    const set = new Set(allDealsRecalculated.map(d => d.stage).filter(Boolean));
    return Array.from(set).sort();
  }, [allDealsRecalculated]);

  const handleStageClick = (stage: string) => {
    setFilter('stage');
    setStageFilter(stage);
    setListExpanded(true);
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const staleDeals = useMemo(() =>
    allDealsRecalculated
      .filter(d => d.is_stale)
      .sort((a, b) => {
        // Sort by days since last activity, descending (most stale first)
        const aDate = a.last_activity_date ? new Date(a.last_activity_date).getTime() : 0;
        const bDate = b.last_activity_date ? new Date(b.last_activity_date).getTime() : 0;
        return aDate - bDate;
      }),
    [allDealsRecalculated],
  );

  const visibleDeals = showAll ? filteredDeals : filteredDeals.slice(0, INITIAL_VISIBLE);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={40} className="text-red-400 mb-4" />
        <p className="text-slate-600 font-medium mb-2">Erro ao carregar dados operacionais</p>
        <p className="text-sm text-slate-400 mb-4">{error}</p>
        <button
          onClick={() => fetchData(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ROW 0: Filter bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <FilterChip active={filter === 'todos'} onClick={() => { setFilter('todos'); setStageFilter(''); }}>
          Todos {allDealsRecalculated.length > 0 ? `(${allDealsRecalculated.length})` : ''}
        </FilterChip>
        <FilterChip
          active={filter === 'parados'}
          onClick={() => { setFilter('parados'); setStageFilter(''); }}
          accent="red"
        >
          Parados {allDealsRecalculated.length > 0 ? `(${allDealsRecalculated.filter(d => d.is_stale).length})` : ''}
        </FilterChip>
        <FilterChip active={filter === 'stage'} onClick={() => setFilter('stage')}>
          Por stage
        </FilterChip>

        {filter === 'stage' && (
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 bg-white"
          >
            <option value="">Selecione...</option>
            {stages.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Stale deals urgency section */}
      {staleDeals.length > 0 && (
        <div className="mb-6">
          <MagicCard className="border-red-200/60 bg-red-50/30 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-red-100/60">
              <div className="p-1.5 rounded-md bg-red-100 text-red-600">
                <Flame size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-red-700 font-display">
                {staleDeals.length} {staleDeals.length === 1 ? 'deal parado' : 'deals parados'} ha 7+ dias
              </span>
            </div>
            <div className="px-4 py-3 space-y-1">
              {staleDeals.slice(0, 5).map((deal, idx) => (
                <DealPipelineRow key={deal.id} deal={deal} index={idx} compact />
              ))}
            </div>
            {staleDeals.length > 5 && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => {
                    setFilter('parados');
                    setStageFilter('');
                    setListExpanded(true);
                    setTimeout(() => {
                      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="w-full text-center text-xs text-red-600 hover:text-red-800 font-medium py-2 border border-red-100 rounded-lg hover:border-red-200 transition-colors"
                >
                  Ver todos os {staleDeals.length} deals parados →
                </button>
              </div>
            )}
          </MagicCard>
        </div>
      )}

      {/* Collapsible deal list (below filters, closed by default) */}
      <div ref={listRef} className="mb-6">
        <MagicCard className="border-slate-200/60 bg-white/60 overflow-hidden">
          <button
            onClick={() => setListExpanded(!listExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display">
              Detalhes dos Deals ({filteredDeals.length})
            </span>
            <motion.div
              animate={{ rotate: listExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400"
            >
              <ChevronDown size={16} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {listExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  {filteredDeals.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Nenhum deal encontrado com o filtro selecionado.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {visibleDeals.map((deal, idx) => (
                          <DealPipelineRow key={deal.id} deal={deal} index={idx} />
                        ))}
                      </div>
                      {!showAll && filteredDeals.length > INITIAL_VISIBLE && (
                        <button
                          onClick={() => setShowAll(true)}
                          className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-700 font-medium py-2 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors"
                        >
                          Ver todos ({filteredDeals.length - INITIAL_VISIBLE} restantes)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </MagicCard>
      </div>

      {/* ROW 1: 4 StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          title="Deals Ativos"
          value={loading ? '...' : String(filteredDeals.length)}
          subtext={allDealsRecalculated.length > 0 ? `${allDealsRecalculated.length} total no pipeline` : undefined}
          loading={loading}
        />
        <StatCard
          icon={Flame}
          title="Parados 7d+"
          value={loading ? '...' : String(chartData.staleCount)}
          highlight={chartData.staleCount > 0}
          subtext={chartData.staleCount > 0 ? 'Requer atencao' : 'Tudo em dia'}
          loading={loading}
        />
        <StatCard
          icon={Clock}
          title="Dias Medio"
          value={loading ? '...' : `${data?.avgDaysInStage ?? 0}d`}
          subtext="Tempo medio no stage"
          loading={loading}
        />
        <StatCard
          icon={BarChart3}
          title="Pipeline"
          value={loading ? '...' : formatCurrency(filteredDeals.reduce((s, d) => s + (d.valor || 0), 0))}
          subtext={`${filteredDeals.length} deals filtrados`}
          loading={loading}
        />
      </div>

      {/* ROW 1.5: Activity Metrics */}
      <ActivityMetricsRow metrics={activityMetrics} loading={activityLoading} />

      {/* Daily Effort Chart — always visible */}
      <div className="mb-6">
        <MagicCard className="border-slate-200/60 bg-white/60 overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display">
              Esforco por Dia
            </p>
          </div>
          <div className="px-4 pb-4">
            {loading && !data ? (
              <div className="h-[260px] bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <div className="h-[260px]">
                <DailyEffortChart
                  efpiData={efpiData}
                  dataInicio={dateBounds.data_inicio || undefined}
                  dataFim={dateBounds.data_fim || undefined}
                />
              </div>
            )}
          </div>
        </MagicCard>
      </div>

      {/* Collapsible charts section */}
      <div className="mb-6">
        <MagicCard className="border-slate-200/60 bg-white/60 overflow-hidden">
          <button
            onClick={() => setChartsExpanded(!chartsExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display">
              Analises Detalhadas (pipeline, aging, comissoes)
            </span>
            <motion.div
              animate={{ rotate: chartsExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400"
            >
              <ChevronDown size={16} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {chartsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-6">
                  {loading && !data ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 h-64 bg-slate-50 rounded-xl animate-pulse" />
                        <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
                        <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Effort vs Result */}
                      <div className="p-4 border border-slate-100 rounded-xl bg-white/80">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 font-display">
                          Esforco vs Resultado
                        </p>
                        <div className="h-[220px]">
                          <EffortVsResultChart metrics={activityMetrics} />
                        </div>
                      </div>

                      {/* Pipeline by Stage + Health */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 p-4 border border-slate-100 rounded-xl bg-white/80">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 font-display">
                            Pipeline por Stage
                          </p>
                          <div className="h-[220px]">
                            <PipelineByStageChart data={chartData.pipelineByStage} onStageClick={handleStageClick} />
                          </div>
                        </div>
                        <div className="p-4 border border-slate-100 rounded-xl bg-white/80">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 font-display">
                            Saude do Pipeline
                          </p>
                          <div className="h-[220px]">
                            <PipelineHealthChart
                              healthPct={chartData.healthPct}
                              healthLabel={chartData.healthLabel}
                              activeCount={chartData.activeCount}
                              staleCount={chartData.staleCount}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Aging + Commission */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-4 border border-slate-100 rounded-xl bg-white/80">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 font-display">
                            Distribuicao de Aging
                          </p>
                          <div className="h-[220px]">
                            <AgingDistributionChart data={chartData.agingDistribution} />
                          </div>
                        </div>
                        <div className="p-4 border border-slate-100 rounded-xl bg-white/80">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 font-display">
                            Comissao por Canal
                          </p>
                          <div className="h-[220px]">
                            <CommissionByCategoryChart
                              data={chartData.commissionByCategory}
                              totalCommission={chartData.totalCommission}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </MagicCard>
      </div>
    </div>
  );
};

// --- Utility sub-component ---

function FilterChip({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: 'red';
}) {
  const base = 'text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer';
  const activeCls =
    accent === 'red'
      ? 'bg-red-50 border-red-200 text-red-600'
      : 'bg-slate-800 border-slate-800 text-white';
  const inactiveCls = 'bg-white border-slate-200 text-slate-500 hover:border-slate-300';

  return (
    <button onClick={onClick} className={`${base} ${active ? activeCls : inactiveCls}`}>
      {children}
    </button>
  );
}
