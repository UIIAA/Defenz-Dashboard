"use client";

import { useState, useEffect } from 'react';

export interface ActivityMetrics {
  emails: number;
  ligacoes: number;
  ligacoes_atendidas: number;
  taxa_conectividade: number;
  reunioes: number;
  apresentacoes: number;
  propostas: number;
}

export function useActivityMetrics(dateRange: string) {
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        setLoading(true);

        const periodoParam = dateRange.startsWith('custom:') ? 'custom' : dateRange;
        const response = await fetch(`/api/dashboard-sheets?periodo=${periodoParam}`);

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (!response.ok || cancelled) {
          setLoading(false);
          return;
        }

        const result = await response.json();
        if (cancelled) return;

        setMetrics({
          emails: Number(result.emails) || 0,
          ligacoes: Number(result.ligacoes) || 0,
          ligacoes_atendidas: Number(result.ligacoes_atendidas) || 0,
          taxa_conectividade: Number(result.taxa_conectividade) || 0,
          reunioes: Number(result.reunioes) || 0,
          apresentacoes: Number(result.apresentacoes) || 0,
          propostas: Number(result.propostas) || 0,
        });
      } catch {
        // Silently fail — cards just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMetrics();
    return () => { cancelled = true; };
  }, [dateRange]);

  return { metrics, loading };
}
