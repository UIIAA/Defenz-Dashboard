import { useMemo } from 'react';
import type { OperationalDeal } from '@/lib/types';
import {
  STAGE_COLORS,
  STAGE_ORDER,
  AGING_BUCKETS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DEFAULT_STAGE_COLOR,
  DEFAULT_CATEGORY_COLOR,
} from '@/components/operational/charts/constants';

export interface PipelineStageData {
  [key: string]: string | number;
  stage: string;
  valor: number;
  deals: number;
  comissao: number;
  color: string;
}

export interface AgingBucketData {
  [key: string]: string | number;
  bucket: string;
  count: number;
  valor: number;
  color: string;
}

export interface CommissionCategoryData {
  [key: string]: string | number;
  categoria: string;
  label: string;
  comissao: number;
  count: number;
  fill: string;
}

export interface OperationalChartData {
  pipelineByStage: PipelineStageData[];
  healthPct: number;
  healthLabel: string;
  activeCount: number;
  staleCount: number;
  agingDistribution: AgingBucketData[];
  commissionByCategory: CommissionCategoryData[];
  totalCommission: number;
}

export function useOperationalCharts(filteredDeals: OperationalDeal[]): OperationalChartData {
  return useMemo(() => {
    // Pipeline by stage
    const stageMap = new Map<string, { valor: number; deals: number; comissao: number }>();
    for (const deal of filteredDeals) {
      const stage = deal.stage || 'Outros';
      const entry = stageMap.get(stage) || { valor: 0, deals: 0, comissao: 0 };
      entry.valor += deal.valor || 0;
      entry.deals += 1;
      entry.comissao += deal.comissao_valor || 0;
      stageMap.set(stage, entry);
    }

    const pipelineByStage: PipelineStageData[] = STAGE_ORDER
      .filter(stage => stageMap.has(stage))
      .map(stage => {
        const entry = stageMap.get(stage)!;
        return {
          stage,
          valor: entry.valor,
          deals: entry.deals,
          comissao: entry.comissao,
          color: STAGE_COLORS[stage] || DEFAULT_STAGE_COLOR,
        };
      });

    // Add stages not in STAGE_ORDER
    for (const [stage, entry] of stageMap) {
      if (!STAGE_ORDER.includes(stage)) {
        pipelineByStage.push({
          stage,
          valor: entry.valor,
          deals: entry.deals,
          comissao: entry.comissao,
          color: DEFAULT_STAGE_COLOR,
        });
      }
    }

    // Pipeline health
    const activeCount = filteredDeals.filter(d => !d.is_stale).length;
    const staleCount = filteredDeals.filter(d => d.is_stale).length;
    const total = filteredDeals.length;
    const healthPct = total > 0 ? Math.round((activeCount / total) * 100) : 100;
    const healthLabel = healthPct >= 70 ? 'Saudavel' : healthPct >= 50 ? 'Atencao' : 'Critico';

    // Aging distribution
    const agingDistribution: AgingBucketData[] = AGING_BUCKETS.map(bucket => {
      const matching = filteredDeals.filter(
        d => d.days_in_stage >= bucket.min && d.days_in_stage <= bucket.max
      );
      return {
        bucket: bucket.label,
        count: matching.length,
        valor: matching.reduce((sum, d) => sum + (d.valor || 0), 0),
        color: bucket.color,
      };
    });

    // Commission by category
    const catMap = new Map<string, { comissao: number; count: number }>();
    for (const deal of filteredDeals) {
      const cat = deal.categoria || 'direto';
      const entry = catMap.get(cat) || { comissao: 0, count: 0 };
      entry.comissao += deal.comissao_valor || 0;
      entry.count += 1;
      catMap.set(cat, entry);
    }

    const commissionByCategory: CommissionCategoryData[] = Array.from(catMap.entries()).map(
      ([cat, entry]) => ({
        categoria: cat,
        label: CATEGORY_LABELS[cat] || cat,
        comissao: entry.comissao,
        count: entry.count,
        fill: CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLOR,
      })
    );

    const totalCommission = commissionByCategory.reduce((sum, c) => sum + c.comissao, 0);

    return {
      pipelineByStage,
      healthPct,
      healthLabel,
      activeCount,
      staleCount,
      agingDistribution,
      commissionByCategory,
      totalCommission,
    };
  }, [filteredDeals]);
}
