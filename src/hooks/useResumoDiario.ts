"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ResumoDiarioResponse } from '@/lib/types';

// `query` é o que vai depois do "?" — ex.: "data=2026-06-15" ou "from=2026-06-01&to=2026-06-15".
export function useResumoDiario(initialQuery: string) {
  const [query, setQuery] = useState<string>(initialQuery);
  const [response, setResponse] = useState<ResumoDiarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, ResumoDiarioResponse>>(new Map());

  const fetchData = useCallback(async (q: string, force = false) => {
    if (!force && cacheRef.current.has(q)) {
      setResponse(cacheRef.current.get(q)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumo-diario?${q}`);
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const json = (await res.json()) as ResumoDiarioResponse;
      cacheRef.current.set(q, json);
      setResponse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar resumo diário');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(query);
  }, [query, fetchData]);

  return {
    query,
    setQuery,
    response,
    loading,
    error,
    refetch: () => fetchData(query, true),
  };
}
