// feature-migracao-neon (Fase 1) — auth máquina-a-máquina da rota de ingestão.
//
// Fica em lib (e não no route.ts) porque o App Router só aceita GET/POST/… como
// export de um route handler — e a rota /api/ingest/paridade precisa reusar isto.

import { constantTimeEqual } from '../auth';

/** Máximo de linhas por requisição (spec §Rota de ingestão). O n8n itera lotes. */
export const MAX_LINHAS = 500;

/** Corpo máximo aceito, como defesa antes mesmo de parsear o JSON. */
export const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Token comparado em tempo constante (mesma primitiva do login).
 * Token ausente ou curto demais FECHA a rota: sem segredo forte configurado, a
 * ingestão simplesmente não existe — nunca fica aberta.
 */
export function tokenValido(header: string | null): boolean {
  const esperado = process.env.INGEST_TOKEN;
  if (!esperado || esperado.length < 16) return false;
  return typeof header === 'string' && constantTimeEqual(header, esperado);
}
