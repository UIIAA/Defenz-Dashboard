"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import type { N8nData, DataSource, TrendDirection, ComparisonData } from '@/lib/types';
import { validateN8nData, checkConsistency } from '@/lib/validation';
import { getCachedData, setCachedData } from '@/lib/cache';
import { generateMockData } from '@/lib/mock-data';
import { normalizeDate, getDateBounds } from '@/lib/formatters';

const REFRESH_INTERVAL_MS = 5_000;

const DAYS_MAP: Record<string, number> = {
  today: 1, '7d': 7, '15d': 15, '30d': 30, month: 30,
};

const REF_LABEL_MAP: Record<string, string> = {
  '7d': 'media 7d',
  '30d': 'media 30d',
  mes: 'mes atual',
};

function computeTrends(
  data: N8nData,
  dateRange: string,
): {
  trends: Record<string, TrendDirection>;
  comparisonLabel: string;
  comparisonDeltas: Record<string, string>;
  comparisonValues: Record<string, number>;
} {
  const empty = { trends: {}, comparisonLabel: '', comparisonDeltas: {}, comparisonValues: {} };
  const comp = data._comparison;
  if (!comp) return empty;

  const currentDays = DAYS_MAP[dateRange] ?? 30;
  const refDays = comp.dias || 30;
  const label = REF_LABEL_MAP[comp.periodo] || comp.periodo;

  const fields: { key: string; currentVal: number; refVal: number; isRate?: boolean }[] = [
    { key: 'comissao_fechado', currentVal: data.comissao_fechado, refVal: comp.comissao_fechado },
    { key: 'deals_fechados', currentVal: data.deals_fechados, refVal: comp.deals_fechados },
    { key: 'ligacoes', currentVal: data.ligacoes, refVal: comp.ligacoes },
    { key: 'emails', currentVal: data.emails, refVal: comp.emails },
    { key: 'reunioes', currentVal: data.reunioes, refVal: comp.reunioes },
    { key: 'taxa_conectividade', currentVal: data.taxa_conectividade, refVal: comp.taxa_conectividade, isRate: true },
    { key: 'win_rate', currentVal: data.win_rate, refVal: comp.win_rate, isRate: true },
    { key: 'ticket_medio', currentVal: data.ticket_medio, refVal: comp.ticket_medio, isRate: true },
    { key: 'contatos_decisor', currentVal: data.contatos_decisor, refVal: comp.contatos_decisor },
    { key: 'contatos_decisor_info', currentVal: data.contatos_decisor_info, refVal: comp.contatos_decisor_info },
  ];

  const trends: Record<string, TrendDirection> = {};
  const deltas: Record<string, string> = {};

  for (const f of fields) {
    let currentRate: number;
    let refRate: number;

    if (f.isRate) {
      // Absolute values, compare directly
      currentRate = f.currentVal;
      refRate = f.refVal;
    } else {
      // Normalize to daily rate for comparison
      currentRate = currentDays > 0 ? f.currentVal / currentDays : 0;
      refRate = refDays > 0 ? f.refVal / refDays : 0;
    }

    if (refRate === 0) {
      if (currentRate > 0) {
        trends[f.key] = 'up';
        deltas[f.key] = '+100%';
      } else {
        trends[f.key] = 'neutral';
        deltas[f.key] = '0%';
      }
      continue;
    }

    const pct = ((currentRate - refRate) / Math.abs(refRate)) * 100;
    const rounded = Math.round(pct);

    if (Math.abs(rounded) < 5) {
      trends[f.key] = 'neutral';
      deltas[f.key] = '0%';
    } else if (rounded > 0) {
      trends[f.key] = 'up';
      deltas[f.key] = `+${rounded}%`;
    } else {
      trends[f.key] = 'down';
      deltas[f.key] = `${rounded}%`;
    }
  }

  const comparisonValues: Record<string, number> = {};
  for (const f of fields) {
    comparisonValues[f.key] = f.refVal;
  }

  return { trends, comparisonLabel: label, comparisonDeltas: deltas, comparisonValues };
}

export function useDashboardData(dateRange: string) {
  const [data, setData] = useState<N8nData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('cache');
  const lastFetchRef = useRef<number>(0);

  const applyValidatedData = (raw: any) => {
    const validated = validateN8nData(raw);
    setData(validated);
    setWarnings(checkConsistency(validated));
  };

  const fetchData = async (range: string, force = false) => {
    // 1) Cache check FIRST (before throttle) — switching filters should be instant
    if (!force) {
      const cached = getCachedData(range);
      if (cached) {
        setDataSource('cache');
        applyValidatedData(cached);
        setLoading(false);
        return;
      }
    }

    // 2) Throttle only applies to API calls (no cache hit)
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFRESH_INTERVAL_MS) {
      return;
    }
    lastFetchRef.current = now;

    try {
      setLoading(true);
      setError(null);
      setWarnings([]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      let parsed: any = null;
      let source: DataSource = 'n8n';

      // Try Sheets API first (supports presets and custom ranges)
      try {
        const sheetsResponse = await fetch(
          `/api/dashboard-sheets?periodo=${encodeURIComponent(range)}`,
          { signal: controller.signal }
        );

        if (sheetsResponse.ok) {
          const sheetsData = await sheetsResponse.json();
          if (sheetsData && !sheetsData.error) {
            parsed = sheetsData;
            source = 'sheets';
          }
        }
      } catch {
        // Sheets failed, try N8N
      }

      if (!parsed) {
        const payload = getDateBounds(range);

        const response = await fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (response.ok) {
          const result = await response.json();

          if (Array.isArray(result)) {
            const first = result[0];
            if (first?.json && typeof first.json === 'object') {
              parsed = first.json;
            } else if (first && typeof first === 'object') {
              parsed = first;
            }
          } else if (result && typeof result === 'object') {
            if (result.json && typeof result.json === 'object') {
              parsed = result.json;
            } else {
              parsed = result;
            }
          }
          source = 'n8n';
        }
      }

      if (parsed && ('ligacoes' in parsed || 'deals_ativos' in parsed || 'valor_pipeline' in parsed)) {
        const validated = validateN8nData(parsed);
        setData(validated);
        setWarnings(checkConsistency(validated));
        setDataSource(source);
        setCachedData(range, validated);
      } else {
        setDataSource('mock');
        applyValidatedData(generateMockData(range));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError("Tempo limite excedido. Tente novamente.");
      } else {
        setError("Não foi possível sincronizar os dados. Tente novamente.");
      }
      setDataSource('mock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange]);

  const funnelData = useMemo(() => {
    if (!data) return [];
    return [
      {
        name: 'Abordagens',
        value: data.ligacoes + data.emails,
        fill: '#ef4444',
        label: 'Abordagens',
        breakdown: [
          { label: 'Ligações', value: data.ligacoes },
          { label: 'E-mails', value: data.emails },
        ],
      },
      { name: 'Apresentações', value: data.apresentacoes, fill: '#f97316', label: 'Apresentações' },
      { name: 'Propostas', value: data.propostas, fill: '#f59e0b', label: 'Propostas' },
      { name: 'Reuniões', value: data.reunioes, fill: '#84cc16', label: 'Reuniões' },
      { name: 'Fechados', value: data.deals_fechados, fill: '#10b981', label: 'Fechados' },
    ];
  }, [data]);

  const { trends, comparisonLabel, comparisonDeltas, comparisonValues } = useMemo(
    () => (data ? computeTrends(data, dateRange) : { trends: {}, comparisonLabel: '', comparisonDeltas: {}, comparisonValues: {} }),
    [data, dateRange],
  );

  const { data_inicio, data_fim } = useMemo(() => getDateBounds(dateRange), [dateRange]);

  const isAllTime = dateRange === 'alltime';

  const filteredDealsAtivos = useMemo(() => {
    if (!data) return [];
    if (isAllTime) return data.deals_ativos;
    return data.deals_ativos.filter(d => {
      const date = normalizeDate(d.id_data) || normalizeDate(d.data);
      if (!date) return true;
      return date >= data_inicio && date <= data_fim;
    });
  }, [data, data_inicio, data_fim, isAllTime]);

  const filteredClientesFechados = useMemo(() => {
    if (!data) return [];
    if (isAllTime) return data.clientes_fechados;
    return data.clientes_fechados.filter(d => {
      const date = normalizeDate(d.id_data) || normalizeDate(d.data);
      if (!date) return true;
      return date >= data_inicio && date <= data_fim;
    });
  }, [data, data_inicio, data_fim, isAllTime]);

  return {
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
  };
}
