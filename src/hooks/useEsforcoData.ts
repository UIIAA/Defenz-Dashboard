"use client";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";

import { useState, useEffect } from 'react';
import type { EsforcoData } from '@/lib/types';

const CACHE_KEY = 'defenz_esforco';


const emptyData: EsforcoData = {
  classificacoes: [],
  metrics: {
    deals_com_resultados: 0,
    taxa_gatekeeper: 0,
    taxa_decisor: 0,
    toques_medio: 0,
    resposta_top1: '-',
    concorrente_top1: '-',
    deals_com_concorrente: 0,
  },
  funnel: [],
  respostas: [],
  concorrentes: [],
};

function getCached(): EsforcoData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(data: EsforcoData): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // ignore
  }
}

export function useEsforcoData() {
  const [data, setData] = useState<EsforcoData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // Check cache first
      const cached = getCached();
      if (cached && cached.classificacoes.length > 0) {
        setData(cached);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/esforco');
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        if (cancelled) return;

        const json = await res.json();
        const parsed: EsforcoData = {
          classificacoes: json.classificacoes || [],
          metrics: json.metrics || emptyData.metrics,
          funnel: json.funnel || [],
          respostas: json.respostas || [],
          concorrentes: json.concorrentes || [],
        };

        setData(parsed);
        if (parsed.classificacoes.length > 0) {
          setCache(parsed);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Erro ao carregar dados de esforco');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
