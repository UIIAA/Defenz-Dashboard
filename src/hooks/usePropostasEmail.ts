'use client';

import { useEffect, useState } from 'react';
import type { PropostasPorRemetente } from '@/lib/propostas';

// feature-proposta-email-exchange — alimenta o card "Propostas (e-mail)" no /diario.

export interface PropostasEmail {
  data: string;
  total: number;
  por_remetente: PropostasPorRemetente[];
  quase_propostas: number;
  erro?: boolean;
}

export function usePropostasEmail(data: string | null) {
  const [dados, setDados] = useState<PropostasEmail | null>(null);

  useEffect(() => {
    if (!data) return;
    let cancelado = false;
    fetch(`/api/propostas-email?data=${encodeURIComponent(data)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelado) setDados(j);
      })
      .catch(() => {
        // Fonte nova: falhar aqui não pode derrubar o resto do /diario.
        if (!cancelado) setDados(null);
      });
    return () => {
      cancelado = true;
    };
  }, [data]);

  // `data` nulo (modo período) não zera o estado dentro do efeito — só não é exposto.
  // "carregando" é derivado: sem estado extra, sem setState síncrono no efeito.
  const alvo = data ? dados : null;
  return { dados: alvo, carregando: data !== null && alvo === null };
}
