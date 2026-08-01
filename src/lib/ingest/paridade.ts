// feature-migracao-neon (Fase 1) — o PORTÃO: comparador Neon × Sheets.
//
// É o atestado de consistência de 28/07 automatizado. A fase só fecha quando as 7
// tabelas ficam verdes por 7 dias corridos (spec §Validação).
//
// REGRA (spec): divergência NÃO se resolve ajustando o comparador — se investiga.
// Foi ajustando o comparador que ninguém viu 11,5k ligações virarem reunião.
//
// As funções aqui são PURAS (resumo do lado Sheets + comparação). O lado Neon é um
// SELECT de agregados em repo.ts, e a rota só junta os dois.

import { isClosedWon } from '../metrics';
import { isoDow, addDays } from '../farol';
import type { Tabela } from './schema';

export type Resumo = Record<string, number | string | null>;

export type StatusChecagem =
  | 'ok' // bate exato
  | 'baseline' // diverge no valor EXATO já investigado e registrado
  | 'obsoleto' // tinha baseline, mas a origem foi consertada — dá pra remover a entrada
  | 'divergente'; // diverge fora do baseline → bloqueia

export interface Checagem {
  nome: string;
  neon: number | string | null;
  sheets: number | string | null;
  /** false só quando BLOQUEIA (status 'divergente') */
  ok: boolean;
  status: StatusChecagem;
  /** diferença numérica (neon − sheets); null quando a checagem é de data */
  delta: number | null;
  nota?: string;
}

/**
 * Divergência já INVESTIGADA, com o delta exato que ela produz.
 *
 * Isto NÃO é o "ajustar o comparador" que a spec proíbe — é o oposto. A regra proibida é
 * mexer no comparador até ficar verde. Aqui o delta esperado é fixo e explícito: se o
 * número mudar, mesmo que por 1, volta a VERMELHO. Um baseline só entra depois de a causa
 * estar apurada e escrita num atestado — por isso `motivo` e `atestado` são obrigatórios.
 */
export interface DivergenciaConhecida {
  tabela: Tabela;
  checagem: string;
  /** valor EXATO de (neon − sheets) que esta causa produz */
  delta: number;
  desde: string;
  motivo: string;
  /** caminho do documento onde a investigação está registrada */
  atestado: string;
}

const ATESTADO_28_07 = 'docs/ATESTADO_PARIDADE_NEON_2026-07-28.md';

/**
 * Baseline de produção. Curto de propósito: baseline que cresce é portão que virou enfeite.
 * Cada linha aqui é um defeito do DADO DE ORIGEM que foi decidido não corrigir na planilha
 * (diretriz de 28/07: nada que o time sinta). Some a entrada quando a origem for corrigida.
 */
export const BASELINE: DivergenciaConhecida[] = [
  {
    tabela: 'ligacoes',
    checagem: 'contagem',
    delta: -5,
    desde: '2026-07-28',
    motivo:
      '3 call_id repetidos na aba somam 5 linhas extras. Dois são a mesma ligação gravada 2×/3×; ' +
      'o terceiro são 3 chamadas distintas colidindo na chave (agente vazio) — o call_id não é único.',
    atestado: ATESTADO_28_07,
  },
  {
    tabela: 'ligacoes',
    checagem: 'soma_duracao',
    delta: -67,
    desde: '2026-07-29',
    motivo:
      'Soma das durações das 5 linhas descartadas pela chave (1 + 16 + 50). INSTÁVEL DE PROPÓSITO: ' +
      'como o call_id colide, o appendOrUpdate do Sheets casa a chave errada e sobrescreve uma ' +
      'chamada com os dados de outra (durações eram 10,25,25 em 28/07 e viraram 25,25,25 em 29/07 — ' +
      'a ligação de 10s foi perdida NA PLANILHA). Se este número mudar de novo, é a colisão ' +
      'corrompendo dado outra vez — não atualize o baseline sem reapurar.',
    atestado: ATESTADO_28_07,
  },
  {
    tabela: 'classificacao_ia',
    checagem: 'leads_distintos',
    delta: -1,
    desde: '2026-07-28',
    motivo:
      'A aba tem uma linha placeholder lead_id="none" emitida pelo nó Preparar IA quando não há ' +
      'lead a classificar. A planilha conta isso como lead; o Neon rejeita pela FK, corretamente.',
    atestado: ATESTADO_28_07,
  },
];

/** Dias úteis sem snapshot já apurados — buraco de coleta de mai/jun, não recuperável. */
export const DIAS_UTEIS_CONHECIDOS = ['2026-05-22', '2026-05-25', '2026-05-28', '2026-06-01'];

export interface Veredito {
  tabela: Tabela;
  veredito: 'verde' | 'vermelho';
  checagens: Checagem[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

function intervalo(linhas: Record<string, unknown>[], campo: string) {
  const datas = linhas
    .map((l) => String(l[campo] ?? '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  return {
    data_min: datas.length ? datas[0] : null,
    data_max: datas.length ? datas[datas.length - 1] : null,
  };
}

/** Agregados do lado Sheets — espelham 1:1 os agregados SQL de resumirNeon(). */
export function resumirSheets(tabela: Tabela, linhas: Record<string, unknown>[]): Resumo {
  switch (tabela) {
    case 'deals':
      return {
        contagem: linhas.length,
        soma_valor: centavos(linhas.reduce((s, d) => s + num(d.valor), 0)),
        soma_licencas: linhas.reduce((s, d) => s + num(d.licencas), 0),
        ganhos: linhas.filter((d) => isClosedWon(String(d.stage ?? ''))).length,
      };
    case 'ligacoes':
      return {
        contagem: linhas.length,
        soma_duracao: linhas.reduce((s, c) => s + num(c.duracao_seg), 0),
        ...intervalo(linhas, 'data'),
      };
    case 'emails':
      return { contagem: linhas.length, ...intervalo(linhas, 'data') };
    case 'classificacao_ia':
      return {
        leads_distintos: new Set(
          linhas.map((c) => String(c.lead_id ?? '').trim()).filter(Boolean)
        ).size,
      };
    case 'resumo_diario':
      return { contagem: linhas.length, ...intervalo(linhas, 'data') };
    case 'leads':
    case 'agenda':
    default:
      return { contagem: linhas.length };
  }
}

const CHECAGENS_DE_DATA = new Set(['data_min', 'data_max']);

export function compararResumos(
  tabela: Tabela,
  neon: Resumo,
  sheets: Resumo,
  baseline: DivergenciaConhecida[] = BASELINE
): Veredito {
  const nomes = Object.keys(sheets);
  const checagens: Checagem[] = nomes.map((nome) => {
    const a = neon[nome] ?? null;
    const b = sheets[nome] ?? null;

    if (CHECAGENS_DE_DATA.has(nome)) {
      const igual = a === b;
      return {
        nome,
        neon: a,
        sheets: b,
        ok: igual,
        status: igual ? 'ok' : 'divergente',
        delta: null,
      };
    }

    const delta = centavos(centavos(num(a)) - centavos(num(b)));
    const conhecida = baseline.find((d) => d.tabela === tabela && d.checagem === nome);

    if (delta === 0) {
      return conhecida
        ? {
            nome,
            neon: a,
            sheets: b,
            ok: true,
            status: 'obsoleto',
            delta,
            nota: `bate exato — a origem foi corrigida, dá pra remover o baseline de ${conhecida.desde}`,
          }
        : { nome, neon: a, sheets: b, ok: true, status: 'ok', delta };
    }

    if (conhecida && delta === conhecida.delta) {
      return {
        nome,
        neon: a,
        sheets: b,
        ok: true,
        status: 'baseline',
        delta,
        nota: `divergência conhecida desde ${conhecida.desde}: ${conhecida.motivo} (ver ${conhecida.atestado})`,
      };
    }

    return {
      nome,
      neon: a,
      sheets: b,
      ok: false,
      status: 'divergente',
      delta,
      nota: conhecida
        ? `DESVIOU do baseline — esperado ${conhecida.delta}, veio ${delta}. Investigue, não atualize o baseline sem apurar.`
        : undefined,
    };
  });

  return {
    tabela,
    veredito: checagens.every((c) => c.ok) ? 'verde' : 'vermelho',
    checagens,
  };
}

/** Dias úteis sem snapshot: só os NÃO conhecidos bloqueiam. */
export function avaliarDiasUteis(
  faltando: string[],
  conhecidos: string[] = DIAS_UTEIS_CONHECIDOS
): { ok: boolean; novos: string[] } {
  const novos = faltando.filter((d) => !conhecidos.includes(d));
  return { ok: novos.length === 0, novos };
}

export interface ParUnificado {
  nome_norm: string;
  variantes: string[];
}

/**
 * spec §Riscos 1: se `nome_norm` unificar variantes, o Neon terá MENOS clientes que o
 * Sheets e a paridade vai acusar. Isso é ACHADO, não erro — hoje o mesmo cliente é
 * contado mais de uma vez. Esta função entrega os pares pra revisão manual.
 */
export function paresUnificados(
  linhas: Record<string, unknown>[],
  campo: string
): ParUnificado[] {
  const porNorm = new Map<string, string[]>();
  for (const linha of linhas) {
    const bruto = linha[campo];
    if (typeof bruto !== 'string') continue;
    const exibicao = bruto.trim().replace(/\s+/g, ' ');
    if (!exibicao) continue;
    const norm = exibicao.toUpperCase();
    const variantes = porNorm.get(norm) ?? [];
    if (!variantes.includes(exibicao)) variantes.push(exibicao);
    porNorm.set(norm, variantes);
  }
  return [...porNorm.entries()]
    .filter(([, variantes]) => variantes.length > 1)
    .map(([nome_norm, variantes]) => ({ nome_norm, variantes }));
}

/** Dias Seg–Sex do intervalo sem snapshot no `resumo_diario` (spec §Validação). */
export function diasUteisFaltando(datas: string[], de: string, ate: string): string[] {
  const tem = new Set(datas.map((d) => String(d).slice(0, 10)));
  const faltando: string[] = [];
  for (let dia = de; dia <= ate; dia = addDays(dia, 1)) {
    if (isoDow(dia) <= 5 && !tem.has(dia)) faltando.push(dia);
  }
  return faltando;
}
