"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import type { N8nData, DataSource } from '@/lib/types';
import { validateN8nData, checkConsistency } from '@/lib/validation';
import { getCachedData, setCachedData } from '@/lib/cache';
import { generateMockData } from '@/lib/mock-data';
import { normalizeDate, getDateBounds } from '@/lib/formatters';

const REFRESH_INTERVAL_MS = 5_000;

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
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFRESH_INTERVAL_MS) {
      return;
    }
    lastFetchRef.current = now;

    if (!force) {
      const cached = getCachedData(range);
      if (cached) {
        setDataSource('cache');
        applyValidatedData(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      setWarnings([]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      let parsed: any = null;
      let source: DataSource = 'n8n';

      // Sheets API only has pre-computed periods (today, 7d, 15d, 30d, month)
      // Custom date ranges must go directly to N8N webhook
      if (!range.startsWith('custom:')) {
        try {
          const sheetsResponse = await fetch(`/api/dashboard-sheets?periodo=${range}`, {
            signal: controller.signal,
          });

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
    fetchData(dateRange, true);
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

  const { data_inicio, data_fim } = useMemo(() => getDateBounds(dateRange), [dateRange]);

  const filteredDealsAtivos = useMemo(() => {
    if (!data) return [];
    return data.deals_ativos.filter(d => {
      const date = normalizeDate(d.id_data) || normalizeDate(d.data);
      if (!date) return true;
      return date >= data_inicio && date <= data_fim;
    });
  }, [data, data_inicio, data_fim]);

  const filteredClientesFechados = useMemo(() => {
    if (!data) return [];
    return data.clientes_fechados.filter(d => {
      const date = normalizeDate(d.id_data) || normalizeDate(d.data);
      if (!date) return true;
      return date >= data_inicio && date <= data_fim;
    });
  }, [data, data_inicio, data_fim]);

  return {
    data,
    loading,
    error,
    warnings,
    dataSource,
    funnelData,
    filteredDealsAtivos,
    filteredClientesFechados,
    fetchData,
  };
}
