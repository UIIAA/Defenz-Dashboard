"use client";

// feature-metas-canal (Spec 2, Task 4) — busca as metas por canal (Neon, via
// /api/metas-canal). `targets` fica `null` enquanto carrega ou se o fetch falhar
// (tabela ainda não migrada, sessão expirada, etc.) — quem consome trata como
// "sem meta" (ver metaPeriodo/hide-bar em ExecutiveDashboard).

import { useState, useEffect, useCallback } from 'react';
import type { ChannelTargets } from '@/lib/types';

export function useChannelTargets() {
  const [targets, setTargets] = useState<ChannelTargets | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/metas-canal');
      if (res.ok) {
        const json = await res.json();
        setTargets({
          direto: Number(json.direto) || 0,
          parceiro: Number(json.parceiro) || 0,
          securisoft: Number(json.securisoft) || 0,
        });
      } else {
        setTargets(null);
      }
    } catch {
      setTargets(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { targets, loading, reload };
}
