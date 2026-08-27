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

/**
 * O que o dashboard lê do NEON e não da planilha: temperatura (f-semaforo) e, desde a
 * feature-038, estado do negócio, antivírus atual e vencimento da licença.
 *
 * Os três da f-038 seguem o mesmo caminho da temperatura pelo mesmo motivo: nenhum deles tem
 * coluna na aba `deals`, e o nó `Sheets Deals` tem `continueOnFail: true`, então coluna
 * ausente é descartada EM SILÊNCIO. O item continua carregando o campo até o `Lote → Neon`,
 * que é como a temperatura já chega hoje.
 */
interface CamposNeon {
  temperatura: string;
  estado_negocio: string | null;
  antivirus_atual: string | null;
  vencimento_licenca: string | null;
  owner_id: string | null;
  owner_nome: string | null;
}

async function camposPorId(): Promise<Map<string, CamposNeon>> {
  const linhas = (await db()`
    select id, temperatura, estado_negocio, antivirus_atual, owner_id, owner_nome,
           to_char(vencimento_licenca, 'YYYY-MM-DD') as vencimento_licenca
    from deals
    where temperatura is not null and temperatura <> ''
       or estado_negocio is not null and estado_negocio <> ''
       or antivirus_atual is not null and antivirus_atual <> ''
       or vencimento_licenca is not null
       or owner_id is not null and owner_id <> ''
  `) as {
    id: string;
    temperatura: string | null;
    estado_negocio: string | null;
    antivirus_atual: string | null;
    vencimento_licenca: string | null;
    owner_id: string | null;
    owner_nome: string | null;
  }[];
  return new Map(
    linhas.map((l) => [
      String(l.id),
      {
        // `to_char` já devolve 'YYYY-MM-DD'. NÃO usar o `Date` que o driver criaria para
        // uma coluna `date`: ele nasce em UTC e, lido em São Paulo, volta um dia — o mesmo
        // erro de fuso que já mordeu a janela de coleta.
        temperatura: String(l.temperatura ?? ''),
        estado_negocio: l.estado_negocio,
        antivirus_atual: l.antivirus_atual,
        vencimento_licenca: l.vencimento_licenca,
        owner_id: l.owner_id,
        owner_nome: l.owner_nome,
      },
    ])
  );
}

export async function carregarOportunidades(hoje: string): Promise<OportunidadesResult> {
  // Em paralelo: uma bate no gviz, a outra no Neon. Não dependem uma da outra.
  const [deals, campos] = await Promise.all([
    fetchFromSheets('deals') as Promise<RawDeal[]>,
    camposPorId().catch((e) => {
      // Neon fora não pode derrubar a tela: sem esses campos, tudo cinza e 'em validação' —
      // que é o mesmo estado de quando ninguém classificou. Degrada, não quebra.
      console.error('oportunidades: campos do Neon indisponíveis', e);
      return new Map<string, CamposNeon>();
    }),
  ]);

  const enriquecidos = deals.map((d) => {
    const c = campos.get(String(d.id ?? ''));
    if (!c) return d;
    return {
      ...d,
      temperatura: c.temperatura || d.temperatura,
      estado_negocio: c.estado_negocio ?? undefined,
      antivirus_atual: c.antivirus_atual ?? undefined,
      vencimento_licenca: c.vencimento_licenca ?? undefined,
      owner_id: c.owner_id ?? undefined,
      owner_nome: c.owner_nome ?? undefined,
    };
  });

  return computeOportunidades(enriquecidos, hoje);
}

/** Data de hoje em São Paulo — `dias_sem_toque` é contagem de dias corridos. */
export function hojeBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
