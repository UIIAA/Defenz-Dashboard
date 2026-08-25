"use client";

// feature-metas-canal (Spec 2, Tasks 4+5) — busca as metas por canal (Neon, via
// /api/metas-canal) e o papel da sessão (via /api/whoami) pra gatear a edição
// inline. `targets` fica `null` enquanto carrega ou se o fetch falhar (tabela
// ainda não migrada, sessão expirada, etc.) — quem consome trata como "sem meta".

import { useState, useEffect, useCallback } from 'react';
import type { ChannelTargets } from '@/lib/types';

export function useChannelTargets() {
  const [targets, setTargets] = useState<ChannelTargets | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [targetsRes, whoamiRes] = await Promise.all([
        fetch('/api/metas-canal'),
        fetch('/api/whoami'),
      ]);

      if (targetsRes.ok) {
        const json = await targetsRes.json();
        setTargets({
          direto: Number(json.direto) || 0,
          parceiro: Number(json.parceiro) || 0,
          securisoft: Number(json.securisoft) || 0,
        });
      } else {
        setTargets(null);
      }

      if (whoamiRes.ok) {
        const json = await whoamiRes.json();
        // super_admin e SUPERSET de admin — comparar com a string crua tirava o lapis dele.
        setCanEdit(json.role === 'admin' || json.role === 'super_admin');
      } else {
        setCanEdit(false);
      }
    } catch {
      setTargets(null);
      setCanEdit(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { targets, canEdit, loading, reload };
}
