"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ResumoDiarioResponse } from '@/lib/types';

export function useResumoDiario(initialData: string) {
  const [data, setData] = useState<string>(initialData);
  const [response, setResponse] = useState<ResumoDiarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, ResumoDiarioResponse>>(new Map());

  const fetchData = useCallback(async (target: string, force = false) => {
    if (!force && cacheRef.current.has(target)) {
      setResponse(cacheRef.current.get(target)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumo-diario?data=${encodeURIComponent(target)}`);
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const json = (await res.json()) as ResumoDiarioResponse;
      cacheRef.current.set(target, json);
      setResponse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar resumo diário');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(data);
  }, [data, fetchData]);

  return {
    data,
    setData,
    response,
    loading,
    error,
    refetch: () => fetchData(data, true),
  };
}
