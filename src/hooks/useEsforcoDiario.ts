"use client";

import { useState, useEffect } from 'react';
import type { DailyEffort } from '@/lib/types';

export function useEsforcoDiario() {
  const [data, setData] = useState<DailyEffort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/operational');
        if (!res.ok || cancelled) { setLoading(false); return; }
        const json = await res.json();
        if (cancelled) return;
        setData(
          (json.esforco_diario || []).map((r: any) => ({
            data: String(r.data || ''),
            calls: Number(r.calls) || 0,
            emails: Number(r.emails) || 0,
            meetings: Number(r.meetings) || 0,
            total: Number(r.total) || 0,
          }))
        );
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
