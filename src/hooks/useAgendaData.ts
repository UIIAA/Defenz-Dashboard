"use client";

import { useState, useEffect } from 'react';
import type { AgendaData } from '@/lib/types';

const CACHE_KEY = 'defenz_agenda';
const CACHE_TTL_MS = 30 * 60 * 1000;

const emptyData: AgendaData = {
  items: [],
  total: 0,
  overdue: 0,
  upcoming_7d: 0,
};

function getCached(): AgendaData | null {
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

function setCache(data: AgendaData): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // ignore
  }
}

export function useAgendaData() {
  const [data, setData] = useState<AgendaData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      const cached = getCached();
      if (cached && cached.items.length > 0) {
        setData(cached);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/agenda');
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        if (cancelled) return;

        const json = await res.json();
        const parsed: AgendaData = {
          items: json.items || [],
          total: json.total || 0,
          overdue: json.overdue || 0,
          upcoming_7d: json.upcoming_7d || 0,
        };

        setData(parsed);
        if (parsed.items.length > 0) {
          setCache(parsed);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Erro ao carregar agenda');
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
