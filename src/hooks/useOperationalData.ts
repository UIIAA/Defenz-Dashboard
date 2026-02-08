"use client";

import { useState, useEffect, useRef } from 'react';
import type { OperationalDeal } from '@/lib/types';

interface OperationalData {
  deals: OperationalDeal[];
  staleCount: number;
  totalDeals: number;
  totalPipeline: number;
  avgDaysInStage: number;
}

const REFRESH_INTERVAL_MS = 5_000;

export function useOperationalData() {
  const [data, setData] = useState<OperationalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchData = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFRESH_INTERVAL_MS) return;
    lastFetchRef.current = now;

    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const response = await fetch('/api/operational', {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error('Falha ao carregar dados operacionais');
      }

      const result = await response.json();

      const operationalData: OperationalData = {
        deals: (result.deals || []).map((d: any) => ({
          id: String(d.id || ''),
          data: d.data || '',
          nome: d.nome || '',
          origem: d.origem || '',
          empresa: d.empresa || '-',
          stage: d.stage || '',
          valor: Number(d.valor) || 0,
          categoria: d.categoria || '',
          comissao_valor: Number(d.comissao_valor) || 0,
          modified_time: d.modified_time || '',
          days_in_stage: Number(d.days_in_stage) || 0,
          last_activity_date: d.last_activity_date || '',
          last_activity_type: d.last_activity_type || 'none',
          activities: (d.activities || []).map((a: any) => ({
            deal_id: String(a.deal_id || ''),
            deal_nome: a.deal_nome || '',
            tipo: a.tipo || 'call',
            data: a.data || '',
            descricao: a.descricao || '',
            vendedor: a.vendedor || '-',
          })),
          is_stale: Boolean(d.is_stale),
        })),
        staleCount: Number(result.staleCount) || 0,
        totalDeals: Number(result.totalDeals) || 0,
        totalPipeline: Number(result.totalPipeline) || 0,
        avgDaysInStage: Number(result.avgDaysInStage) || 0,
      };

      setData(operationalData);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError("Tempo limite excedido. Tente novamente.");
      } else {
        setError(err?.message || "Erro ao carregar dados operacionais.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, fetchData };
}
