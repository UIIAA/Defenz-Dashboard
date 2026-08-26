// Montagem dos dados da tela de oportunidades — feature-semaforo-oportunidades.
//
// HÍBRIDO, e o motivo é concreto: os deals vêm da planilha (é de lá que o dashboard lê hoje),
// mas a `temperatura` vem do NEON. A coluna `temperatura` teria que ser criada à mão no
// cabeçalho da aba, e o nó `Sheets Deals` tem `continueOnFail: true` — coluna ausente é
// descartada EM SILÊNCIO. Lendo do Neon, o caminho não depende de passo manual nem do modo de
// falha que já custou R$ 19.962 em comissão errada.
//
// Quando a Fase 2 virar `deals` para o Neon, o join some: tudo vem da mesma fonte.

import { db } from './db';
import { fetchFromSheets } from './sheets';
import { computeOportunidades, type OportunidadesResult } from './oportunidades';
import type { RawDeal } from './types';

/** Temperatura por deal_id, direto do Neon. Só os que têm valor — a maioria não tem. */
async function temperaturaPorId(): Promise<Map<string, string>> {
  const linhas = (await db()`
    select id, temperatura from deals
    where temperatura is not null and temperatura <> ''
  `) as { id: string; temperatura: string }[];
  return new Map(linhas.map((l) => [String(l.id), String(l.temperatura)]));
}

export async function carregarOportunidades(hoje: string): Promise<OportunidadesResult> {
  // Em paralelo: uma bate no gviz, a outra no Neon. Não dependem uma da outra.
  const [deals, temps] = await Promise.all([
    fetchFromSheets('deals') as Promise<RawDeal[]>,
    temperaturaPorId().catch((e) => {
      // Neon fora não pode derrubar a tela: sem temperatura, todas cinzas — que é o mesmo
      // estado de quando ninguém classificou. Degrada, não quebra.
      console.error('oportunidades: temperatura do Neon indisponível', e);
      return new Map<string, string>();
    }),
  ]);

  const comTemp = deals.map((d) => {
    const t = temps.get(String(d.id ?? ''));
    return t ? { ...d, temperatura: t } : d;
  });

  return computeOportunidades(comTemp, hoje);
}

/** Data de hoje em São Paulo — `dias_sem_toque` é contagem de dias corridos. */
export function hojeBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
