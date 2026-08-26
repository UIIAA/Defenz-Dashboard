// Oportunidades abertas — feature-semaforo-oportunidades.
// Cálculo puro (sem rede, sem banco) para ser testável sozinho.

import { isClosedWon, isClosedLost } from './metrics';
import { ultimoToque } from './ultimo-toque';
import type { RawDeal } from './types';

export type Temperatura = 'quente' | 'morno' | 'frio';

/** Estágio da geladeira: tem gatilho datado próprio, não é oportunidade em andamento. */
const GELADEIRA = 'contato futuro';

/**
 * Aberto = NÃO é fechado (ganho/perdido) e NÃO é a geladeira.
 *
 * DENYLIST de propósito. A v1 da spec usava uma allowlist de 6 estágios — e um estágio novo
 * ou renomeado sumiria da tela EM SILÊNCIO. Foi assim que `Grandes Contas` (existe no picklist
 * do Zoho) não apareceu na spec. Com denylist, estágio desconhecido aparece; que é o
 * comportamento seguro para uma tela cujo trabalho é não deixar negócio esquecido.
 */
export function isAberto(stage: string): boolean {
  const s = String(stage || '').toLowerCase().trim();
  if (!s) return false;
  return !isClosedWon(s) && !isClosedLost(s) && s !== GELADEIRA;
}

export interface Oportunidade {
  id: string;
  nome: string;
  stage: string;
  valor: number;
  licencas: number;
  /** '' quando não classificado — a tela mostra cinza e cobra. */
  temperatura: Temperatura | '';
  /** Último registro datado do `resultados`. null quando o texto não tem data. */
  ultimo_toque: string | null;
  dias_sem_toque: number | null;
  /** Texto literal do último andamento escrito pelo vendedor no Zoho. */
  ultimo_andamento: string | null;
  // SEM comissao_valor: a tela é aberta ao time (spec §5.2) e o campo é margem da Defenz.
}

export interface OportunidadesResult {
  itens: Oportunidade[];
  total: number;
  valor_total: number;
  sem_classificacao: number;
}

const TEMPS: Temperatura[] = ['quente', 'morno', 'frio'];

function normalizaTemp(v: unknown): Temperatura | '' {
  const t = String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  return (TEMPS as string[]).includes(t) ? (t as Temperatura) : '';
}

export function computeOportunidades(
  deals: RawDeal[],
  hoje: string
): OportunidadesResult {
  const itens: Oportunidade[] = [];

  for (const d of deals) {
    if (!isAberto(String(d.stage || ''))) continue;
    const toque = ultimoToque(String(d.resultados || ''), hoje);
    itens.push({
      id: String(d.id ?? ''),
      nome: String(d.nome ?? ''),
      stage: String(d.stage ?? ''),
      valor: Number(d.valor) || 0,
      licencas: Number(d.licencas) || 0,
      temperatura: normalizaTemp(d.temperatura),
      ultimo_toque: toque.data,
      dias_sem_toque: toque.dias,
      ultimo_andamento: toque.texto,
    });
  }

  // Não classificados primeiro (a tela cobra), depois valor decrescente.
  itens.sort((a, b) => {
    const semA = a.temperatura === '' ? 0 : 1;
    const semB = b.temperatura === '' ? 0 : 1;
    if (semA !== semB) return semA - semB;
    return b.valor - a.valor;
  });

  return {
    itens,
    total: itens.length,
    valor_total: itens.reduce((s, x) => s + x.valor, 0),
    sem_classificacao: itens.filter((x) => x.temperatura === '').length,
  };
}
