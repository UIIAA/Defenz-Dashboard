// Metas por canal (feature-metas-canal / Spec 2) — meta mensal fixa por canal
// (Direto/Parceiro/SecuriSoft), persistida no Neon (tabela channel_targets) e
// escalada proporcionalmente ao período filtrado na `/` (ReceitaPorCanalSection).
//
// Escala pura (metaPeriodo/diasNoPeriodo) é testada em isolamento — sem tocar o
// banco. O repo (getChannelTargets/setChannelTargets) é thin sobre src/lib/db.ts,
// mesmo padrão de src/lib/users.ts — NÃO unit-testado aqui (hits Neon).

import { db } from './db';
import type { CanalCategoria, ChannelTarget, ChannelTargets } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function diasNoPeriodo(from: string, to: string): number {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((b - a) / 86400000) + 1;
}

export function metaPeriodo(mensal: number, dias: number): number {
  return Math.round((Number(mensal) || 0) * dias / 30);
}

export async function getChannelTargets(): Promise<ChannelTargets> {
  const rows = (await db()`select categoria, valor_mensal from channel_targets`) as ChannelTarget[];
  const out: ChannelTargets = { direto: 0, parceiro: 0, securisoft: 0 };
  for (const r of rows) out[r.categoria] = Number(r.valor_mensal) || 0;
  return out;
}

export async function setChannelTargets(t: ChannelTargets, updatedBy: string): Promise<void> {
  const cats: CanalCategoria[] = ['direto', 'parceiro', 'securisoft'];
  for (const c of cats) {
    await db()`update channel_targets set valor_mensal = ${t[c]}, updated_at = now(), updated_by = ${updatedBy} where categoria = ${c}`;
  }
}
